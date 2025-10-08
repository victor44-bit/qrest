// app/api/chains/[id]/contributions/[contribId]/replies/[...ids]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- CORS ---------------- */
const ALLOW = "GET,POST,HEAD,OPTIONS,PUT,PATCH,DELETE";
const allowHeadersDefault =
  "Content-Type, Authorization, X-Requested-With, x-parent-id, x-contrib-id, x-reply-id, Accept, Origin";

function withCors(req: NextRequest, res: NextResponse) {
  const origin = (req.headers.get("Origin") || "*").toString();
  const reqAllow = req.headers.get("Access-Control-Request-Headers") || allowHeadersDefault;
  res.headers.set("Allow", ALLOW);
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", ALLOW);
  res.headers.set("Access-Control-Allow-Headers", reqAllow);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Max-Age", "86400");
  res.headers.set("Vary", "Origin, Access-Control-Request-Headers, Access-Control-Request-Method");
  return res;
}
const J = (req: NextRequest, s: number, p: any) => withCors(req, NextResponse.json(p, { status: s }));

/* ---------------- utils ---------------- */
type RunAggResult = { cursor?: { firstBatch?: any[] } };
const isHex24 = (s?: string) => !!s && /^[0-9a-f]{24}$/i.test(s);
const isBad = (s?: string) => !s || s === "undefined" || s === "null";
const toIso = (v: any) => {
  try {
    const d = new Date((v && v.$date) ? v.$date : v ?? Date.now());
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch { return new Date().toISOString(); }
};
const idToString = (v: any) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if ((v as any)?.$oid) return String((v as any).$oid);
  // @ts-ignore
  if (typeof v?.toHexString === "function") return v.toHexString();
  if (typeof v?.toString === "function") {
    const s = v.toString(); return s === "[object Object]" ? "" : s;
  }
  try { return JSON.stringify(v); } catch { return ""; }
};
const addIdString = (field: string) => ({
  $cond: [
    { $eq: [{ $type: `$${field}` }, "objectId"] },
    { $toString: `$${field}` },
    { $ifNull: [`$${field}`, null] },
  ],
});
const parseTake = (v: string | null, def = 10, max = 100) => {
  const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
};
const safe = (s: string) => encodeURIComponent(String(s));
const buildIdOr = (id: string) => {
  const or: any[] = [
    { $expr: { $eq: [{ $toString: "$_id" }, id] } },
    { _id: id }, { id }, { $expr: { $eq: ["$id", id] } },
  ];
  if (isHex24(id)) or.unshift({ $expr: { $eq: ["$_id", { $toObjectId: id }] } });
  return or;
};

/* ---------------- core helpers ---------------- */
function lastParentId(params: { ids?: string[] } | undefined): string {
  const arr = (params?.ids ?? []).map((s) => String(s || "").trim()).filter(Boolean);
  // Accept both styles:
  //   /replies/<id>/replies/<id>/replies/<id>  => last non-"replies" token
  //   /replies/<id>/<id>/<id>                  => last token
  const filtered = arr.filter((t) => t.toLowerCase() !== "replies");
  return filtered[filtered.length - 1] || "";
}

/* ---------------- GET: list children of the LAST reply id in the path ---------------- */
export async function GET(req: NextRequest, { params }: { params: { id: string; contribId: string; ids?: string[] } }) {
  const chainId = String(params?.id ?? "");
  const parentId = lastParentId(params);
  const take = parseTake(req.nextUrl.searchParams.get("take"), 10, 100);

  if (isBad(chainId)) return J(req, 400, { error: "bad-chainId" });
  if (isBad(parentId)) return J(req, 400, { error: "bad-parentId" });

  try {
    // 1) Load parent reply and validate chain by parent's chainId
    const parentAgg = (await prisma.$runCommandRaw({
      aggregate: "Contribution",
      pipeline: [
        { $match: { $or: buildIdOr(parentId) } },
        { $set: { _idStr: { $toString: "$_id" }, chainIdStr: addIdString("chainId") } },
        { $limit: 1 },
      ],
      cursor: {},
    } as any)) as RunAggResult;

    const parent = parentAgg?.cursor?.firstBatch?.[0];
    if (!parent) return J(req, 404, { error: "parent-not-found" });
    if (String(parent.chainIdStr ?? "") !== chainId) {
      return J(req, 400, { error: "chain-reply-mismatch", chainId, parentChainId: String(parent.chainIdStr ?? "") });
    }

    // 2) Fetch children under this reply
    const kidsAgg = (await prisma.$runCommandRaw({
      aggregate: "Contribution",
      pipeline: [
        { $set: {
            _idStr: { $toString: "$_id" },
            parentIdStr: addIdString("parentId"),
            authorIdStr: addIdString("authorId"),
            createdAt: { $convert: { input: "$createdAt", to: "date", onNull: "$$NOW", onError: "$$NOW" } },
        }},
        { $match: { parentIdStr: { $eq: parent._idStr } } },
        { $lookup: {
            from: "User",
            let: { aid: "$authorIdStr" },
            pipeline: [
              { $addFields: { _idStr: { $toString: "$_id" } } },
              { $match: { $expr: { $eq: ["$_idStr", "$$aid"] } } },
              { $project: { _id: 1, name: 1 } },
            ],
            as: "authorDocs",
        }},
        { $set: { authorDoc: { $first: "$authorDocs" } } },
        { $project: { _id: 1, id: "$_idStr", text: 1, likes: 1, createdAt: 1, authorName: "$authorDoc.name" } },
        { $sort: { createdAt: 1, _id: 1 } },
        { $limit: take },
      ],
      cursor: {},
    } as any)) as RunAggResult;

    const items = (kidsAgg?.cursor?.firstBatch ?? []).map((r: any) => ({
      id: String(r.id ?? idToString(r._id)),
      text: r.text,
      likes: r.likes ?? 0,
      createdAt: toIso(r.createdAt),
      authorName: r.authorName ?? "Anon",
    }));

    return J(req, 200, { items, nextCursor: null });
  } catch (e: any) {
    console.error(`GET replies/[...ids] error:`, e);
    return J(req, 500, { error: `server-error: ${String(e?.message ?? e)}` });
  }
}

/* ---------------- POST: create child under the LAST reply id in the path ---------------- */
export async function POST(req: NextRequest, { params }: { params: { id: string; contribId: string; ids?: string[] } }) {
  const chainId = String(params?.id ?? "");
  const parentId = lastParentId(params);

  if (isBad(chainId)) return J(req, 400, { error: "bad-chainId" });
  if (isBad(parentId)) return J(req, 400, { error: "bad-parentId" });

  // body
  let text = "";
  try {
    const body = await req.json().catch(() => ({}));
    text = String(body?.text ?? "").trim();
  } catch {}
  if (!text) return J(req, 400, { error: "text-required" });
  if (text.length > 4000) return J(req, 400, { error: "text-too-long" });

  // optional author from cookie
  const meCookie = cookies().get("qrest_user")?.value ?? "";
  let authorIdStr: string | undefined;
  if (meCookie) { try { const p = JSON.parse(meCookie); if (p?.id && isHex24(p.id)) authorIdStr = String(p.id); } catch {} }

  try {
    // 1) Load parent reply and validate chain
    const parentAgg = (await prisma.$runCommandRaw({
      aggregate: "Contribution",
      pipeline: [
        { $match: { $or: buildIdOr(parentId) } },
        { $set: { _idStr: { $toString: "$_id" }, chainIdStr: addIdString("chainId") } },
        { $limit: 1 },
      ],
      cursor: {},
    } as any)) as RunAggResult;

    const parent = parentAgg?.cursor?.firstBatch?.[0];
    if (!parent) return J(req, 404, { error: "parent-not-found" });
    if (String(parent.chainIdStr ?? "") !== chainId) {
      return J(req, 400, { error: "chain-reply-mismatch", chainId, parentChainId: String(parent.chainIdStr ?? "") });
    }

    // 2) Insert child reply
    const now = new Date();
    const doc: any = {
      text,
      createdAt: now,
      likes: 0,
      chainId: (parent as any).chainId ?? undefined,
      parentId: (parent as any)._id,
      ...(authorIdStr ? { authorId: authorIdStr } : {}),
    };

    const insertRes = await prisma.$runCommandRaw({ insert: "Contribution", documents: [doc] } as any);
    const rawId =
      (insertRes as any)?.insertedIds?.[0] ??
      (insertRes as any)?.insertedId ??
      (insertRes as any)?.insertedIds?.["0"];
    const newId = idToString(rawId);

    const repliesUrl = `/api/chains/${safe(chainId)}/contributions/${safe(newId)}/replies?take=10`;

    return withCors(req, NextResponse.json({
      id: newId,
      parentId: String(parent._idStr ?? idToString(parent._id)),
      chainId: String(parent.chainIdStr ?? chainId),
      text,
      likes: 0,
      createdAt: now.toISOString(),
      authorName: "Anon",
      repliesUrl,
    }, { status: 201 }));
  } catch (e: any) {
    console.error(`POST replies/[...ids] error:`, e);
    return J(req, 500, { error: `server-error: ${String(e?.message ?? e)}` });
  }
}

/* ---------------- 405 guards so this route never 405s ---------------- */
export async function OPTIONS(req: NextRequest) { return withCors(req, new NextResponse(null, { status: 204 })); }
export async function HEAD(req: NextRequest)    { return withCors(req, new NextResponse(null, { status: 200 })); }
export async function PUT(req: NextRequest, ctx: any)    { return (await GET(req as any, ctx)) as any; }
export async function PATCH(req: NextRequest, ctx: any)  { return (await GET(req as any, ctx)) as any; }
export async function DELETE(req: NextRequest)           { return withCors(req, new NextResponse(null, { status: 204 })); }
