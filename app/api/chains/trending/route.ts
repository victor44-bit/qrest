// app/api/chains/trending/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    // MongoDB pipeline via Prisma aggregateRaw for performance + flexibility
    const docs = await prisma.chain.aggregateRaw({
      pipeline: [
        {
          $project: {
            _id: 1,
            title: 1,
            tags: 1,
            likes: 1,
            views: { $ifNull: ["$views", 0] },
            createdAt: 1,
            images: { $ifNull: ["$images", []] },
          },
        },
        // Highest views first; break ties by most recent
        { $sort: { views: -1, createdAt: -1 } },
        { $limit: 20 },

        // Optional: count contributions for each chain (for richer cards)
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
            views: 1,
            createdAt: 1,
            images: 1,
            _count_contributions: {
              $ifNull: [{ $arrayElemAt: ["$_contribCount.n", 0] }, 0],
            },
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
    }));

    return NextResponse.json(out);
  } catch (e) {
    console.error("GET /api/chains/trending ERROR:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
