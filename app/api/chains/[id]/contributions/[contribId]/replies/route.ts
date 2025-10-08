import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- CORS / Method Allowance ---------------- */
const ALLOW = "GET,POST,HEAD,OPTIONS,PUT,PATCH,DELETE";
const allowHeadersDefault =
  "Content-Type, Authorization, X-Requested-With, x-parent-id, x-contrib-id, x-reply-id, Accept, Origin";

const withCors = (req: NextRequest, res: NextResponse) => {
  const origin = (req.headers.get("Origin") || "*").toString();
  const reqAllowHeaders =
    req.headers.get("Access-Control-Request-Headers") || allowHeadersDefault;

  res.headers.set("Allow", ALLOW);
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", ALLOW);
  res.headers.set("Access-Control-Allow-Headers", reqAllowHeaders);
  res.headers.set("Access-Control-Allow-Credentials", "true");
  res.headers.set("Access-Control-Max-Age", "86400");
  res.headers.set("Vary", "Origin, Access-Control-Request-Headers, Access-Control-Request-Method");
  return res;
};

const J = (req: NextRequest, s: number, p: any) =>
  withCors(req, NextResponse.json(p, { status: s }));

export async function OPTIONS(req: NextRequest) {
  return withCors(req, new NextResponse(null, { status: 204 }));
}
export async function HEAD(req: NextRequest) {
  return withCors(req, new NextResponse(null, { status: 200 }));
}

/* ---------- EXTRA VERB GUARDS (405-proof) ---------- */
export async function PUT(req: NextRequest, ctx: any) { return GET(req, ctx); }
export async function PATCH(req: NextRequest, ctx: any) { return GET(req, ctx); }
export async function DELETE(req: NextRequest) { return withCors(req, new NextResponse(null, { status: 204 })); }

type RunAggResult = { cursor?: { firstBatch?: any[] } };

/* ---------------- utils ---------------- */
const toIso = (v: any): string => {
  try {
    if (!v) return new Date().toISOString();
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "object" && v.$date) return new Date(v.$date).toISOString();
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch { return new Date().toISOString(); }
};
const isHex24 = (s?: string | null) => !!s && /^[0-9a-f]{24}$/i.test(s);
const isBadId = (s?: string | null) => !s || s === "undefined" || s === "null";
const parseTake = (v: string | null, def = 10, max = 100) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
};
const addIdString = (field: string) => ({
  $cond: [
    { $eq: [{ $type: `$${field}` }, "objectId"] },
    { $toString: `$${field}` },
    { $ifNull: [`$${field}`, null] },
  ],
});
const idToString = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if ((v as any)?.$oid) return String((v as any).$oid);
  // @ts-ignore
  if (typeof v?.toHexString === "function") return v.toHexString();
  if (typeof v?.toString === "function") {
    const s = v.toString();
    return s === "[object Object]" ? "" : s;
  }
  try { return JSON.stringify(v); } catch { return ""; }
};
const safe = (s: string) => encodeURIComponent(String(s));

const buildParentMatchOr = (contribIdParam: string) => {
  const or: any[] = [
    { $expr: { $eq: [{ $toString: "$_id" }, contribIdParam] } },
    { _id: contribIdParam },
    { id: contribIdParam },
    { $expr: { $eq: ["$id", contribIdParam] } },
  ];
  if (isHex24(contribIdParam)) {
    or.unshift({ $expr: { $eq: ["$_id", { $toObjectId: contribIdParam }] } });
  }
  return or;
};

type RunCmd = Parameters<typeof prisma.$runCommandRaw>[0];

async function getChainIdCandidates(chainIdParam: string) {
  const cmd: RunCmd = {
    aggregate: "Chain",
    pipeline: [
      {
        $match: {
          $or: [
            ...(isHex24(chainIdParam) ? [{ $expr: { $eq: ["$_id", { $toObjectId: chainIdParam }] } }] : []),
            { $expr: { $eq: [{ $toString: "$_id" }, chainIdParam] } },
            { _id: chainIdParam },
            { id: chainIdParam },
            { $expr: { $eq: ["$id", chainIdParam] } },
          ],
        },
      },
      { $limit: 1 },
      { $set: { _idStr: { $toString: "$_id" }, idStr: addIdString("id") } },
      { $project: { _idStr: 1, idStr: 1 } },
    ],
    cursor: {},
  } as any;

  const agg = (await prisma.$runCommandRaw(cmd)) as RunAggResult;
  const c = agg?.cursor?.firstBatch?.[0];
  if (!c) return null;

  const candidates = new Set<string>();
  if (c._idStr) candidates.add(String(c._idStr));
  if (c.idStr) candidates.add(String(c.idStr));
  candidates.add(chainIdParam);
  return candidates;
}

function resolveContribId(req: NextRequest, chainIdParam: string, paramId?: string) {
  const param = (paramId ?? "").trim();
  if (!isBadId(param)) return param;

  const q = req.nextUrl.searchParams;
  const h = headers();
  const c = cookies();

  const candidates = [
    q.get("parentId"),
    q.get("contribId"),
    q.get("id"),
    q.get("replyId"),
    q.get("nodeId"),
    q.get("targetId"),
    h.get("x-parent-id"),
    h.get("x-contrib-id"),
    h.get("x-reply-id"),
  ]
    .filter((s): s is string => typeof s === "string" && !isBadId(s))
    .map((s) => s.trim());

  if (!candidates.length) {
    const lastChain = c.get("qrest_last_chain")?.value || "";
    const lastParent = c.get("qrest_last_parent")?.value || "";
    if (!isBadId(lastChain) && !isBadId(lastParent) && String(lastChain) === String(chainIdParam)) {
      candidates.push(lastParent);
    }
  }
  return candidates[0] || "";
}

/* ---------------- GET (list replies) ---------------- */
export async function GET(req: NextRequest, { params }: { params: { id: string; contribId?: string } }) {
  const chainIdParam = String(params?.id ?? "").trim();
  const contribIdParam = resolveContribId(req, chainIdParam, params?.contribId ?? "");

  const take = parseTake(req.nextUrl.searchParams.get("take"), 10, 100);
  const debug = req.nextUrl.searchParams.get("debug") === "1";

  if (isBadId(chainIdParam)) return J(req, 400, { error: "bad-chainId" });
  if (isBadId(contribIdParam)) return J(req, 400, { error: "bad-contribId" });

  try {
    const chainCandidates = await getChainIdCandidates(chainIdParam);
    if (!chainCandidates) {
      return J(req, 404, debug ? { error: "chain-not-found", chainId: chainIdParam, debug: true } : { error: "not-found" });
    }

    // parent contribution (or reply)
    const parentAgg = (await prisma.$runCommandRaw({
      aggregate: "Contribution",
      pipeline: [
        { $match: { $or: buildParentMatchOr(contribIdParam) } },
        { $set: { chainIdStr: addIdString("chainId"), _idStr: { $toString: "$_id" } } },
        { $limit: 1 },
      ],
      cursor: {},
    } as any)) as RunAggResult;

    const parent = parentAgg?.cursor?.firstBatch?.[0];
    if (!parent) {
      return J(req, 404, debug ? { error: "parent-not-found", chainId: chainIdParam, contribId: contribIdParam, debug: true } : { error: "parent-not-found" });
    }

    const parentChainStr = String(parent.chainIdStr ?? "");
    if (!chainCandidates.has(parentChainStr)) {
      return J(req, 400, {
        error: "chain-contrib-mismatch",
        chainId: chainIdParam,
        parentChainId: parentChainStr,
        contribId: contribIdParam,
        debug: true,
      });
    }

    // Replies, oldest → newest, with replyCount per item
    const repliesAgg = (await prisma.$runCommandRaw({
      aggregate: "Contribution",
      pipeline: [
        {
          $set: {
            _idStr: { $toString: "$_id" },
            parentIdStr: addIdString("parentId"),
            authorIdStr: addIdString("authorId"),
            createdAt: { $convert: { input: "$createdAt", to: "date", onNull: "$$NOW", onError: "$$NOW" } },
          }
        },
        { $match: { parentIdStr: { $eq: parent._idStr } } },

        // author
        {
          $lookup: {
            from: "User",
            let: { aid: "$authorIdStr" },
            pipeline: [
              { $addFields: { _idStr: { $toString: "$_id" } } },
              { $match: { $expr: { $eq: ["$_idStr", "$$aid"] } } },
              { $project: { _id: 1, name: 1 } },
            ],
            as: "authorDocs",
          }
        },
        { $set: { authorDoc: { $first: "$authorDocs" } } },

        // replyCount (count direct children)
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
                    ]
                  }
                }
              },
              { $match: { $expr: { $eq: ["$parentIdStr", "$$rid"] } } },
              { $count: "count" },
            ],
            as: "childCounts",
          }
        },
        { $set: { replyCount: { $ifNull: [{ $first: "$childCounts.count" }, 0] } } },

        { $project: { _id: 1, id: "$_idStr", text: 1, likes: 1, replyCount: 1, createdAt: 1, authorName: "$authorDoc.name" } },
        { $sort: { createdAt: 1, _id: 1 } }, // stable asc
        { $limit: take },
      ],
      cursor: {},
    } as any)) as RunAggResult;

    const replies = (repliesAgg?.cursor?.firstBatch ?? []).map((r: any) => ({
      id: String(r.id ?? idToString(r._id)),
      text: r.text,
      likes: r.likes ?? 0,
      replyCount: r.replyCount ?? 0,
      createdAt: toIso(r.createdAt),
      authorName: r.authorName ?? "Anon",
    }));

    return J(req, 200, { items: replies, nextCursor: null, debug });
  } catch (e: any) {
    console.error("GET replies error:", e);
    return J(req, 500, { error: `server-error: ${String(e?.message ?? e)}`, debug: true });
  }
}

/* ---------------- POST (create reply — infinite nesting) ---------------- */
export async function POST(req: NextRequest, { params }: { params: { id: string; contribId?: string } }) {
  const chainIdParam = String(params?.id ?? "").trim();
  const contribIdFromPath = String(params?.contribId ?? "").trim();

  if (isBadId(chainIdParam)) return J(req, 400, { error: "bad-chainId" });

  // Parse body early (accept optional parentId here to support deep nesting reliably)
  let text = "";
  let parentIdFromBody: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    text = String(body?.text ?? "").trim();
    if (body?.parentId) parentIdFromBody = String(body.parentId).trim();
  } catch {}
  if (!text) return J(req, 400, { error: "text-required" });
  if (text.length > 4000) return J(req, 400, { error: "text-too-long" });

  // optional author
  const meCookie = cookies().get("qrest_user")?.value ?? "";
  let authorIdStr: string | undefined;
  if (meCookie) {
    try {
      const p = JSON.parse(meCookie);
      if (isHex24(p?.id)) authorIdStr = String(p.id);
    } catch {}
  }

  // Resolve the ACTUAL parent: prefer body.parentId, else headers/cookies/qs, else path contribId
  const parentIdResolved =
    parentIdFromBody && !isBadId(parentIdFromBody)
      ? parentIdFromBody
      : resolveContribId(req, chainIdParam, contribIdFromPath);

  if (isBadId(parentIdResolved)) return J(req, 400, { error: "bad-parentId" });

  try {
    const chainCandidates = await getChainIdCandidates(chainIdParam);
    if (!chainCandidates) return J(req, 404, { error: "chain-not-found" });

    // Find parent (can be a contribution or another reply; same collection)
    const parentAgg = (await prisma.$runCommandRaw({
      aggregate: "Contribution",
      pipeline: [
        { $match: { $or: buildParentMatchOr(parentIdResolved) } },
        { $set: { chainIdStr: addIdString("chainId"), _idStr: { $toString: "$_id" } } },
        { $limit: 1 },
      ],
      cursor: {},
    } as any)) as RunAggResult;

    const parent = parentAgg?.cursor?.firstBatch?.[0];
    if (!parent) return J(req, 404, { error: "parent-not-found" });

    const parentChainStr = String(parent.chainIdStr ?? "");
    if (!chainCandidates.has(parentChainStr)) {
      return J(req, 400, {
        error: "chain-contrib-mismatch",
        chainId: chainIdParam,
        parentChainId: parentChainStr,
        contribId: parentIdResolved,
      });
    }

    const now = new Date();
    const doc: any = {
      text,
      createdAt: now,
      likes: 0,
      chainId: (parent as any).chainId ?? undefined,
      parentId: (parent as any)._id, // reply to either contribution or reply
    };
    if (authorIdStr && isHex24(authorIdStr)) doc.authorId = authorIdStr;

    const insertRes = await prisma.$runCommandRaw({ insert: "Contribution", documents: [doc] } as any);
    const rawId =
      (insertRes as any)?.insertedIds?.[0] ??
      (insertRes as any)?.insertedId ??
      (insertRes as any)?.insertedIds?.["0"];
    const insertedIdStr = idToString(rawId);

    let authorName: string | undefined = undefined;
    if (authorIdStr && isHex24(authorIdStr)) {
      try {
        const u = await prisma.user.findUnique({ where: { id: authorIdStr }, select: { name: true } });
        authorName = u?.name || undefined;
      } catch {}
    }

    const chainIdOut = parentChainStr;
    const newParentIdOut = insertedIdStr;
    const repliesUrl = `/api/chains/${safe(chainIdOut)}/contributions/${safe(newParentIdOut)}/replies?take=10`;

    const payload = {
      id: insertedIdStr,
      parentId: String(parent._idStr ?? idToString(parent._id)),
      chainId: chainIdOut,
      text,
      likes: 0,
      createdAt: now.toISOString(),
      authorName: authorName ?? "Anon",
      repliesUrl,
    };

    const res = withCors(req, NextResponse.json(payload, { status: 201 }));
    res.cookies.set("qrest_last_chain", chainIdOut, { path: "/", httpOnly: false, sameSite: "lax" });
    res.cookies.set("qrest_last_parent", newParentIdOut, { path: "/", httpOnly: false, sameSite: "lax" });
    return res;
  } catch (e: any) {
    console.error("POST replies raw-insert error:", e);
    return J(req, 500, { error: `server-error: ${String(e?.message ?? e)}` });
  }
}
