// app/api/uploads/[file]/route.ts
import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "fs";
import { join, basename } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { file: string } }) {
  // prevent path traversal - only use the basename
  const safeName = basename(params.file || "");
  const p = join(process.cwd(), "uploads", safeName);

  if (!existsSync(p)) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const stream = createReadStream(p);
  const readable = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(readable, {
    headers: {
      "Content-Type": detect(safeName),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function detect(name: string) {
  const e = name.toLowerCase().split(".").pop();
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "gif") return "image/gif";
  if (e === "webp") return "image/webp";
  return "application/octet-stream";
}
