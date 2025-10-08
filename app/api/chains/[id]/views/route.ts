// app/api/chains/[id]/views/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const isHex24 = (s: unknown) =>
  typeof s === "string" && /^[0-9a-f]{24}$/i.test(String(s));

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const chainId = params?.id ?? "";
  if (!isHex24(chainId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    // Use $inc (Mongo will create the field if missing) and return the updated doc
    const r = (await prisma.$runCommandRaw({
      findAndModify: "Chain",
      query: { _id: { $oid: chainId } },
      update: { $inc: { views: 1 } },
      new: true,
      upsert: false,
      writeConcern: { w: "majority" },
    } as any)) as any;

    const v = r?.value?.views;
    if (typeof v === "number") {
      return NextResponse.json(
        { views: v },
        { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
      );
    }

    // Fallback: read back via Prisma
    const after = await prisma.chain.findUnique({
      where: { id: chainId },
      select: { views: true },
    });
    if (!after) {
      return NextResponse.json({ error: "Chain not found" }, { status: 404 });
    }

    return NextResponse.json(
      { views: typeof after.views === "number" ? after.views : 0 },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (e) {
    console.error(`POST /api/chains/${chainId}/views ERROR:`, e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
