// app/api/admin/users/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

export async function GET(req: Request) {
  const guard = requireAdmin();
  if (guard) return guard;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    // Build Mongo pipeline that tolerates null createdAt
    const pipeline: any[] = [];

    if (q) {
      pipeline.push({
        $match: {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push(
      // Ensure createdAt is always a valid date, defaulting to now
      {
        $set: {
          createdAt: {
            $convert: { input: "$createdAt", to: "date", onNull: "$$NOW", onError: "$$NOW" },
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $project: {
          id: { $toString: "$_id" },
          name: 1,
          email: 1,
          createdAt: 1,
        },
      }
    );

    const docs = (await prisma.$runCommandRaw({
      aggregate: "User",
      pipeline,
      cursor: {},
    } as any)) as { cursor?: { firstBatch?: any[] } };

    const users = (docs?.cursor?.firstBatch ?? []).map((u: any) => ({
      id: String(u.id),
      name: u.name ?? null,
      email: String(u.email ?? ""),
      createdAt: new Date(u.createdAt).toISOString(),
    }));

    return NextResponse.json({ users });
  } catch (e: any) {
    console.error("GET /api/admin/users error:", e);
    const msg =
      process.env.NODE_ENV === "development" ? String(e?.message || e) : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
