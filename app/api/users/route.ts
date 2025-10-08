// app/api/users/route.ts
// for user management (admin-only) — it has nothing to do with chains
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

// derive a timestamp from a Mongo ObjectId string ("65123456....")
// first 8 hex chars are seconds since epoch
function createdAtFromObjectId(id: string): string {
  try {
    const secs = parseInt(id.slice(0, 8), 16);
    if (Number.isFinite(secs)) return new Date(secs * 1000).toISOString();
  } catch {}
  return new Date().toISOString();
}

export async function GET(req: Request) {
  // Only admins
  const guard = requireAdmin();
  if (guard) return guard;

  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();

    // Mongo: basic "contains" (case-sensitive). If you need case-insensitive,
    // we can switch to a regex-based filter later.
    const where =
      q.length > 0
        ? {
            OR: [
              { name:  { contains: q } },
              { email: { contains: q } },
            ],
          }
        : undefined;

    // IMPORTANT: do NOT select createdAt to avoid Prisma null->non-null crash
    const raw = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true }, // ← no createdAt
      orderBy: { createdAt: "desc" }, // safe even if some are null
      take: 200,
    });

    // Safely attach a createdAt for the UI
    const users = raw.map((u: { id: string; name: string | null; email: string }) => {
      // If your docs actually have a createdAt sometimes, you can fetch it separately.
      // To stay bulletproof, we always compute from ObjectId here:
      const createdAt = createdAtFromObjectId(u.id);
      return { ...u, createdAt };
    });

    return NextResponse.json({ users });
  } catch (e: any) {
    console.error("GET /api/users error:", e);
    const msg =
      process.env.NODE_ENV === "development" ? String(e?.message || e) : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
