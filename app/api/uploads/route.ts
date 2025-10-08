import { NextResponse } from "next/server";
import { imagekit } from "@/lib/imagekit";
import { randomUUID } from "crypto";
import { extname } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_VERSION = "uploads-v3"; // <- shows up as x-qrest-upload header

const MAX_FILES = 6;
const MAX_FILE_MB = 8;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);
const ALLOWED_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

const isAllowed = (name: string, type?: string | null) => {
  const ext = extname(name || "").toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) return false;
  if (type && !ALLOWED_MIMES.has(type.toLowerCase())) return false;
  return true;
};

type FileLike = Blob & { name?: string; type?: string; size: number };

// helper to always add our header
function withVersion<T>(body: T, status = 200) {
  const res = NextResponse.json(body as any, { status });
  res.headers.set("x-qrest-upload", ROUTE_VERSION);
  return res;
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const entries = [...form.getAll("files"), ...form.getAll("file")];

    const files: FileLike[] = [];
    for (const v of entries) {
      if (typeof v === "string") continue;
      files.push(v as FileLike);
    }

    if (!files.length) {
      return withVersion({ error: "No files" }, 400);
    }
    if (files.length > MAX_FILES) {
      return withVersion({ error: `Too many files (max ${MAX_FILES})` }, 400);
    }

    const urls: string[] = [];

    for (const blob of files) {
      const size = blob.size ?? 0;
      const type = (blob as any).type as string | undefined;
      const name = ((blob as any).name as string | undefined) || "upload.png";

      if (size <= 0) return withVersion({ error: `Empty file: ${name}` }, 400);
      if (size > MAX_FILE_BYTES) {
        return withVersion(
          { error: `File too large: ${name} (max ${MAX_FILE_MB}MB)` },
          400
        );
      }
      if (!isAllowed(name, type)) {
        return withVersion({ error: `Unsupported file type: ${name}` }, 400);
      }

      const ext = extname(name || "").toLowerCase() || ".png";
      const fileName = `${randomUUID()}${ext}`;

      const buffer = Buffer.from(await blob.arrayBuffer());
      const base64 = buffer.toString("base64");

      const uploaded = await imagekit.upload({
        file: base64,
        fileName,
        folder: "/uploads",
      });

      urls.push(uploaded.url);
    }

    return withVersion({ urls }, 201);
  } catch (e) {
    console.error("UPLOAD ERROR:", e);
    return withVersion({ error: "upload-failed" }, 500);
  }
}
