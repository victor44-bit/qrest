import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isHex24 = (s: unknown): s is string =>
  typeof s === "string" && /^[0-9a-f]{24}$/i.test(String(s));

type PostBody = {
  text?: string;
  images?: unknown; // optional from UI
};

const MAX_IMAGES = 6;
const sanitizeImages = (input: unknown): string[] => {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    const url = v.trim();
    if (!url) continue;
    const ok =
      url.startsWith("/api/uploads/") ||
      /^https?:\/\/.+\.(?:png|jpe?g|gif|webp)(?:\?.*)?$/i.test(url) ||
      /^https?:\/\/ik\.imagekit\.io\/[A-Za-z0-9_\-]+\/.+/i.test(url);
    if (ok) {
      out.push(url);
      if (out.length >= MAX_IMAGES) break;
    }
  }
  return Array.from(new Set(out));
};

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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const chainId = String(params?.id ?? "");
    if (!isHex24(chainId)) {
      return NextResponse.json(
        { error: "Invalid chain id (expect 24-char hex)" },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as PostBody;

    // normalize/validate text
    const textRaw = typeof body?.text === "string" ? body.text : "";
    const textNorm = textRaw.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
    if (!textNorm) return NextResponse.json({ error: "Text required" }, { status: 400 });
    const paragraphs = textNorm.split(/\n/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 5) return NextResponse.json({ error: "Up to five paragraphs allowed" }, { status: 400 });
    if (textNorm.length > 4000) return NextResponse.json({ error: "Max 4000 characters" }, { status: 400 });

    // optional images
    const images = sanitizeImages(body.images);

    // current user (optional)
    let authorId: string | null = null;
    const cookie = cookies().get("qrest_user");
    if (cookie?.value) {
      try {
        const parsed = JSON.parse(cookie.value) as { id?: string };
        if (parsed?.id && isHex24(parsed.id)) authorId = parsed.id;
      } catch {}
    }

    // ensure chain exists
    const chain = await prisma.chain.findUnique({
      where: { id: chainId },
      select: { id: true },
    });
    if (!chain) return NextResponse.json({ error: "Chain not found" }, { status: 404 });

    // create contribution via Prisma (more reliable than raw command)
    const created = await prisma.contribution.create({
      data: {
        text: textNorm,
        likes: 0,
        createdAt: new Date(),
        chainId: chainId,
        authorId: authorId ?? null, // only set if valid ObjectId; else null
        images,                      // [] or sanitized list
      } as any,
      select: {
        id: true,
        text: true,
        images: true,
        likes: true,
        createdAt: true,
        authorId: true,
      },
    });

    // bump the chain so dynamic ordering (bumpedAt desc) moves it to top
    // (if you haven't added bumpedAt to your schema, add it: bumpedAt DateTime?)
    try {
      await prisma.chain.update({
        where: { id: chainId },
        data: { bumpedAt: new Date() } as any,
        select: { id: true },
      });
    } catch {
      // ignore if field not present yet
    }

    // return a shape your UI can use immediately
    return NextResponse.json(
      {
        ok: true,
        id: String(created.id),
        text: created.text,
        images: Array.isArray(created.images) ? created.images : [],
        likes: typeof created.likes === "number" ? created.likes : 0,
        createdAt: toIso(created.createdAt),
        authorId: created.authorId ? String(created.authorId) : null,
        authorName: null, // UI usually shows "Anon" if null; you can resolve name on client
        replyCount: 0,
        parentId: null,
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("POST /api/chains/[id]/contributions ERROR:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
