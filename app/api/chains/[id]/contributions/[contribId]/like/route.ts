import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const isHex24 = (s: unknown) => typeof s === "string" && /^[0-9a-f]{24}$/i.test(String(s));

export async function POST(_req: Request, { params }: { params: { id: string; contribId: string } }) {
  try {
    const chainId = params?.id ?? "";
    const contribId = params?.contribId ?? "";
    if (!isHex24(chainId) || !isHex24(contribId)) {
      return NextResponse.json({ error: "Invalid id(s)" }, { status: 400 });
    }

    // Ensure the contribution belongs to this chain
    const contrib = await prisma.contribution.findUnique({
      where: { id: contribId },
      select: { id: true, chainId: true },
    });
    if (!contrib) return NextResponse.json({ error: "Contribution not found" }, { status: 404 });
    if (String(contrib.chainId) !== chainId) {
      return NextResponse.json({ error: "Contribution not in this chain" }, { status: 400 });
    }

    const updated = await prisma.contribution.update({
      where: { id: contribId },
      data: { likes: { increment: 1 } },
      select: { likes: true },
    });

    return NextResponse.json({ ok: true, likes: updated.likes ?? 0 }, { status: 200 });
  } catch (e: any) {
    console.error(`POST /api/chains/${params.id}/contributions/${params.contribId}/like ERROR:`, e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
