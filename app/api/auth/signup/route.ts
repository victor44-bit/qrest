// app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!name || !email || !password) {
      return NextResponse.json({ ok: false, error: "Name, email and password are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }

    // Ensure email uniqueness (normalized)
    const exists = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ ok: false, error: "Email already registered." }, { status: 409 });
    }

    // Hash & create user
    const hash = await bcrypt.hash(password, 10);
    const created = await prisma.user.create({
      data: {
        name,
        email,
        password: hash,
        // Explicit is fine even with @default(now()) in schema; keeps raw insert parity
        createdAt: new Date(),
      },
      select: { id: true, name: true, email: true },
    });

    // Issue cookie session
    const session = { id: created.id, name: created.name, email: created.email };
    const res = NextResponse.json({ ok: true, user: session });

    // Clear any stale cookie first (harmless if none)
    res.cookies.set("qrest_user", "", { path: "/", maxAge: 0 });

    res.cookies.set("qrest_user", JSON.stringify(session), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (e: any) {
    console.error("POST /api/auth/signup ERROR:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Server error" }, { status: 500 });
  }
}
