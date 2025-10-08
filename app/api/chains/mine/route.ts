import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toIso = (v: any): string => {
  try {
    if (!v) return new Date().toISOString();
    if (v instanceof Date) return v.toISOString();
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

const parseLimit = (value: string | null, def = 20, max = 100) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
};

// Robust cookie parser: supports plain JSON, URI-encoded JSON, or base64 JSON
function parseUserCookie(raw: string | undefined | null): { id: string } | null {
  if (!raw) return null;

  const tryJson = (s: string) => {
    try {
      const obj = JSON.parse(s);
      const id = obj?.id ?? obj?.user?.id ?? obj?.uid ?? null;
      return typeof id === "string" && id ? { id } : null;
    } catch {
      return null;
    }
  };

  // 1) plain JSON
  const plain = tryJson(raw);
  if (plain) return plain;

  // 2) URI-encoded JSON
  try {
    const decoded = decodeURIComponent(raw);
    const uri = tryJson(decoded);
    if (uri) return uri;
  } catch {}

  // 3) base64 JSON
  try {
    const b64 = Buffer.from(raw, "base64").toString("utf8");
    const fromB64 = tryJson(b64);
    if (fromB64) return fromB64;
  } catch {}

  return null;
}

const getUserFromCookie = () => {
  const jar = cookies();
  const raw = jar.get("qrest_user")?.value;
  return parseUserCookie(raw);
};

export async function GET(req: NextRequest) {
  try {
    const me = getUserFromCookie();
    if (!me) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseLimit(searchParams.get("limit"));
    const cursor = searchParams.get("cursor");
    const order = (searchParams.get("order") === "asc" ? "asc" : "desc") as "asc" | "desc";
    const q = searchParams.get("q")?.trim();
    const includeCounts = searchParams.get("includeCounts") !== "0";

    const where: any = { authorId: me.id };
    if (q) {
      where.OR = [{ title: { contains: q, mode: "insensitive" } }];
    }

    const findArgs: any = {
      where,
      take: limit + 1,
      orderBy: { createdAt: order },
      select: {
        id: true,
        authorId: true,
        title: true,
        tags: true,
        likes: true,
        createdAt: true,
        ...(includeCounts && {
          _count: { select: { contributions: true } },
        }),
      },
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1;
    }

    const rows = await prisma.chain.findMany(findArgs);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const last = rows.pop()!;
      nextCursor = String(last.id);
    }

    const data = rows.map((r) => ({
      id: String(r.id),
      authorId: String(r.authorId),
      title: r.title ?? "",
      tags: r.tags ?? [],
      likes: r.likes ?? 0,
      createdAt: toIso(r.createdAt),
      counts: includeCounts
        ? { contributions: (r as any)._count?.contributions ?? 0 }
        : undefined,
    }));

    return NextResponse.json({ ok: true, data, nextCursor });
  } catch (err: any) {
    console.error("/api/chains/mine", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
