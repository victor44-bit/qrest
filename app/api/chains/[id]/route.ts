// app/api/chains/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const J = (s: number, p: any) => NextResponse.json(p, { status: s });
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0; // 👈 always fresh for detail fetch

type RunAggResult = { cursor?: { firstBatch?: any[] } };

// Safe ISO from Date/object/string
const toIso = (v: any): string => {
  try {
    if (!v) return new Date().toISOString();
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object" && v.$date) return new Date(v.$date).toISOString();
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

// Build a string version of an id field that might be ObjectId or string
const addIdString = (field: string) => ({
  $cond: [
    { $eq: [{ $type: `$${field}` }, "objectId"] },
    { $toString: `$${field}` },
    { $ifNull: [`$${field}`, null] },
  ],
});

// ---------- GET /api/chains/[id] ----------
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = String(params?.id ?? "");
    if (!id) return J(400, { error: "Invalid id" });

    // who am I? (for canDelete)
    const meCookie = cookies().get("qrest_user")?.value ?? "";
    let meId: string | null = null;
    if (meCookie) {
      try {
        const parsed = JSON.parse(meCookie);
        if (parsed?.id) meId = String(parsed.id);
      } catch {}
    }

    // Use an aggregation so we can stringify IDs reliably and tolerate string/ObjectId storage
    const agg = (await prisma.$runCommandRaw({
      aggregate: "Chain",
      pipeline: [
        // Match chain by id (works whether _id is ObjectId or string)
        {
          $match: {
            $or: [
              { $expr: { $eq: ["$_id", { $toObjectId: id }] } },
              { $expr: { $eq: [{ $toString: "$_id" }, id] } },
              { _id: id },
            ],
          },
        },
        { $limit: 1 },

        // Normalize fields
        {
          $set: {
            _idStr: { $toString: "$_id" },
            createdAt: {
              $convert: { input: "$createdAt", to: "date", onNull: "$$NOW", onError: "$$NOW" },
            },
            authorIdStr: addIdString("authorId"),
            viewsNorm: { $ifNull: ["$views", 0] },          // 👈 ensure views always exists
            images: { $ifNull: ["$images", []] },
          },
        },

        // Chain author name
        {
          $lookup: {
            from: "User",
            let: { aid: "$authorIdStr" },
            pipeline: [
              { $addFields: { _idStr: { $toString: "$_id" } } },
              { $match: { $expr: { $eq: ["$_idStr", "$$aid"] } } },
              { $project: { _id: 1, name: 1 } },
            ],
            as: "chainAuthorDocs",
          },
        },
        { $set: { chainAuthorDoc: { $first: "$chainAuthorDocs" } } },

        // Only TOP-LEVEL contributions (parentId == null/absent) + replyCount
        {
          $lookup: {
            from: "Contribution",
            pipeline: [
              // Match contributions by chainId (string or ObjectId)
              {
                $match: {
                  $or: [
                    { $expr: { $eq: ["$chainId", { $toObjectId: id }] } },
                    { $expr: { $eq: [{ $toString: "$chainId" }, id] } },
                    { chainId: id },
                  ],
                },
              },
              // Normalize ids and parentId, authorId for robust comparisons
              {
                $set: {
                  _idStr: { $toString: "$_id" },
                  parentIdStr: {
                    $cond: [
                      { $eq: [{ $type: "$parentId" }, "objectId"] },
                      { $toString: "$parentId" },
                      { $ifNull: ["$parentId", null] },
                    ],
                  },
                  createdAt: {
                    $convert: { input: "$createdAt", to: "date", onNull: "$$NOW", onError: "$$NOW" },
                  },
                  authorIdStr: addIdString("authorId"),
                  imagesArr: { $ifNull: ["$images", []] }, // normalize images
                },
              },
              // Keep ONLY top-level contributions
              { $match: { parentIdStr: null } },

              // Attach author name
              {
                $lookup: {
                  from: "User",
                  let: { aid: "$authorIdStr" },
                  pipeline: [
                    { $addFields: { _idStr: { $toString: "$_id" } } },
                    { $match: { $expr: { $eq: ["$_idStr", "$$aid"] } } },
                    { $project: { _id: 1, name: 1 } },
                  ],
                  as: "contribAuthorDocs",
                },
              },
              { $set: { contribAuthorDoc: { $first: "$contribAuthorDocs" } } },

              // replyCount (count direct children of each top-level contribution)
              {
                $lookup: {
                  from: "Contribution",
                  let: { rid: "$_idStr" },
                  pipeline: [
                    {
                      $set: {
                        parentIdStr: {
                          $cond: [
                            { $eq: [{ $type: "$parentId" }, "objectId"] },
                            { $toString: "$parentId" },
                            { $ifNull: ["$parentId", null] },
                          ],
                        },
                      },
                    },
                    { $match: { $expr: { $eq: ["$parentIdStr", "$$rid"] } } },
                    { $count: "count" },
                  ],
                  as: "childCounts",
                },
              },
              { $set: { replyCount: { $ifNull: [{ $first: "$childCounts.count" }, 0] } } },

              {
                $project: {
                  id: "$_idStr",
                  text: 1,
                  images: "$imagesArr", // include images (always an array)
                  likes: 1,
                  createdAt: 1,
                  authorId: "$authorIdStr",
                  authorName: { $ifNull: ["$contribAuthorDoc.name", "Anon"] },
                  replyCount: 1,
                  parentId: "$parentIdStr", // present but null for top-level
                },
              },
              { $sort: { createdAt: 1, _id: 1 } }, // stable asc for UI
            ],
            as: "topLevelContributions",
          },
        },

        // Final shape
        {
          $project: {
            id: "$_idStr",
            title: 1,
            tags: 1,
            likes: 1,
            views: "$viewsNorm",                      // 👈 expose normalized views
            images: 1,
            createdAt: 1,
            authorId: "$authorIdStr",
            authorName: { $ifNull: ["$chainAuthorDoc.name", "Anon"] },
            contributions: "$topLevelContributions",
          },
        },
      ],
      cursor: {},
    } as any)) as RunAggResult;

    const doc = agg?.cursor?.firstBatch?.[0];
    if (!doc) return J(404, { error: "Not found" });

    const canDelete = !!(meId && doc?.authorId && String(doc.authorId) === String(meId));

// ...inside GET right before return:
return NextResponse.json(
  {
    id: String(doc.id),
    title: doc.title,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    likes: typeof doc.likes === "number" ? doc.likes : 0,
    views: typeof doc.views === "number" ? doc.views : 0,
    images: Array.isArray(doc.images) ? doc.images : [],
    createdAt: toIso(doc.createdAt),
    authorId: doc.authorId ? String(doc.authorId) : null,
    authorName: doc.authorName ?? "Anon",
    canDelete,
    contributions: (doc.contributions ?? []).map((c: any) => ({
      id: String(c.id),
      text: c.text,
      images: Array.isArray(c.images) ? c.images : [],
      likes: typeof c.likes === "number" ? c.likes : 0,
      createdAt: toIso(c.createdAt),
      authorId: c.authorId ?? null,
      authorName: c.authorName ?? "Anon",
      replyCount: typeof c.replyCount === "number" ? c.replyCount : 0,
      parentId: c.parentId ?? null,
    })),
  },
  { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
);

  } catch (e) {
    console.error(`GET /api/chains/${(params as any)?.id} ERROR:`, e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ---------- POST /api/chains/[id] (like) ----------
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = String(params?.id ?? "");
    if (!id) return J(400, { error: "Invalid id" });

    const updated = await prisma.chain.update({
      where: { id },
      data: { likes: { increment: 1 } },
      select: { id: true, likes: true },
    });

    return NextResponse.json({ ok: true, likes: updated.likes });
  } catch (e: any) {
    if (e?.code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error(`POST /api/chains/${params.id} (like) ERROR:`, e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ---------- DELETE /api/chains/[id] ----------
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const id = String(params?.id ?? "");
    if (!id) return J(400, { error: "Invalid id" });

    const meCookie = cookies().get("qrest_user")?.value ?? "";
    let meId: string | null = null;
    if (meCookie) {
      try { meId = String(JSON.parse(meCookie)?.id ?? ""); } catch {}
    }
    if (!meId) return J(401, { error: "Unauthorized" });

    const chain = await prisma.chain.findUnique({
      where: { id },
      select: { id: true, authorId: true },
    });
    if (!chain) return J(404, { error: "Not found" });
    if (String(chain.authorId) !== String(meId)) return J(403, { error: "Forbidden" });

    await prisma.contribution.deleteMany({ where: { chainId: id } });
    await prisma.chain.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`DELETE /api/chains/${params.id} ERROR:`, e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
