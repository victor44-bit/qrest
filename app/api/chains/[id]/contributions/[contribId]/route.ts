// app/api/chains/[id]/contributions/[contribId]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isHex24 = (s: unknown) => typeof s === "string" && /^[0-9a-f]{24}$/i.test(String(s));

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; contribId: string } }
) {
  const chainId = params?.id ?? "";
  const contribId = params?.contribId ?? "";

  // 1) Param guard
  if (!isHex24(chainId) || !isHex24(contribId)) {
    return NextResponse.json({ error: "Invalid id(s)" }, { status: 400 });
  }

  // 2) Session guard
  const cookie = cookies().get("qrest_user");
  if (!cookie) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let me: { id?: string; role?: string } = {};
  try {
    me = JSON.parse(cookie.value);
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  if (!me?.id || !isHex24(me.id)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    // 3) Fetch once; if missing, idempotent success
    const contrib = await prisma.contribution.findUnique({
      where: { id: contribId },
      select: { id: true, chainId: true, authorId: true },
    });
    if (!contrib) {
      return new NextResponse(null, { status: 204 });
    }

    // Normalize potential ObjectId values to strings
    const contribChainId = String(contrib.chainId);
    const contribAuthorId = String(contrib.authorId);

    // Chain mismatch → safe no-op
    if (contribChainId !== chainId) {
      return new NextResponse(null, { status: 204 });
    }

    // 4) Authorization: owner or admin
    const isOwner = contribAuthorId === String(me.id);
    const isAdmin = typeof me.role === "string" && me.role.toLowerCase() === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: not your contribution" }, { status: 403 });
    }

    // 5) Idempotent delete (won’t throw if already gone)
    await prisma.contribution.deleteMany({ where: { id: contribId } });

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error(`DELETE /api/chains/${chainId}/contributions/${contribId} ERROR:`, e);
    // Don’t leak details to client; keep logs server-side
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
