// app/api/auth/forgot/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email } = (await req.json().catch(() => ({}))) as { email?: string };
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Return 200 even if user not found (don’t leak existence)
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    await prisma.passwordResetToken.create({
      data: {
        token,         // unique field in your schema
        userId: user.id,
        expiresAt,
        used: false,
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    await sendMail({
      to: email,
      subject: "Reset your Qrest password",
      html: `
        <p>We received a request to reset your password.</p>
        <p><a href="${resetUrl}">Click here to reset your password</a></p>
        <p>Or use this token: <code>${token}</code></p>
        <p>This token expires in 30 minutes.</p>
      `,
      text: `Reset your password: ${resetUrl}\nToken: ${token}`,
    });

    // 👇 Return the token so the client can immediately navigate to /reset-password/[token]
    return NextResponse.json({ ok: true, token });
  } catch (e) {
    console.error("POST /api/auth/forgot ERROR:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
