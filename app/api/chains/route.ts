// app/api/chains/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0; // always fresh

const isHex24 = (s: unknown) =>
  typeof s === "string" && /^[0-9a-f]{24}$/i.test(String(s || ""));

const normalizeId = (x: any) =>
  typeof x === "string"
    ? x
    : x?.$oid
    ? String(x.$oid)
    : x?.toHexString
    ? x.toHexString()
    : String(x ?? "");

const toIso = (v: any): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v?.$date ?? v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

// ---------- GET: feed ----------
export async function GET() {
  try {
    const docs = await prisma.chain.aggregateRaw({
      pipeline: [
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "User",
            localField: "authorId",
            foreignField: "_id",
            as: "authorDoc",
          },
        },
        {
          $lookup: {
            from: "Contribution",
            let: { cid: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      { $toString: { $ifNull: ["$chainId", ""] } },
                      { $toString: { $ifNull: ["$$cid", ""] } },
                    ],
                  },
                },
              },
              { $count: "n" },
            ],
            as: "_contribCount",
          },
        },
        {
          $project: {
            _id: 1,
            title: 1,
            tags: 1,
            likes: 1,
            createdAt: 1,
            images: { $ifNull: ["$images", []] },
            views: { $ifNull: ["$views", 0] },
            _count_contributions: {
              $ifNull: [{ $arrayElemAt: ["$_contribCount.n", 0] }, 0],
            },
            authorName: { $ifNull: [{ $arrayElemAt: ["$authorDoc.name", 0] }, null] },
            authorId: "$authorId",
          },
        },
      ],
    });

    const out = (Array.isArray(docs) ? docs : []).map((d: any) => ({
      id: normalizeId(d._id),
      title: String(d.title ?? ""),
      tags: Array.isArray(d.tags) ? d.tags : [],
      likes: typeof d.likes === "number" ? d.likes : 0,
      views: typeof d.views === "number" ? d.views : 0,
      contributions:
        typeof d._count_contributions === "number" ? d._count_contributions : 0,
      createdAt: toIso(d.createdAt),
      images: Array.isArray(d.images) ? d.images : [],
      authorName: typeof d.authorName === "string" ? d.authorName : null,
      authorId: typeof d.authorId === "string" ? d.authorId : null,
    }));

    return NextResponse.json(out, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    console.error("GET /api/chains ERROR:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ---------- POST: create chain (login required) ----------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title ?? "").trim();
    const tags: string[] = Array.isArray(body?.tags)
      ? body.tags.map((t: unknown) => String(t)).filter(Boolean)
      : [];

    // ImageKit URLs from client (optional)
    const images: string[] = Array.isArray(body?.images)
      ? body.images
          .map((u: unknown) => (typeof u === "string" ? u.trim() : ""))
          .filter(Boolean)
          .slice(0, 6)
      : [];

    if (!title)
      return NextResponse.json({ error: "Title required" }, { status: 400 });

    // author required
    const cookie = cookies().get("qrest_user");
    let authorId: string | null = null;
    if (cookie) {
      try {
        const { id } = JSON.parse(cookie.value) as { id?: string };
        // accept any string id; if you really require ObjectId-like ids, keep the isHex24 check
        if (id && typeof id === "string") authorId = id;
      } catch {}
    }
    if (!authorId) {
      return NextResponse.json(
        { error: "Login required to create a chain" },
        { status: 401 }
      );
    }

    // ✅ Create the chain in one Prisma call (no Mongo raw updates)
    const created = await prisma.chain.create({
      data: {
        title,
        tags,
        likes: 0,
        views: 0,
        authorId,
        images, // <— set images here instead of raw update
      } as any,
      select: { id: true },
    });

    return NextResponse.json(
      { ok: true, id: created.id },
      {
        status: 201,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      }
    );
  } catch (e: any) {
    console.error("POST /api/chains ERROR:", e?.message || e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}