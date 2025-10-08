// app/api/auth/reset/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { token, password } = (await req.json().catch(() => ({}))) as {
      token?: string;
      password?: string;
    };

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and new password are required" },
        { status: 400 }
      );
    }

    // find token in DB
    const reset = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!reset || reset.used || reset.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // update password
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: reset.userId },
      data: { password: hash },
    });

    // mark token as used
    await prisma.passwordResetToken.update({
      where: { id: reset.id },
      data: { used: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/auth/reset ERROR:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
