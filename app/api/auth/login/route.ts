// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    });

    // Hide which field was wrong
    if (!user) {
      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }

    const session = { id: user.id, name: user.name, email: user.email };

    // Build response and set session cookie
    const res = NextResponse.json({ ok: true, user: session });

    // Optional: clear any old cookie first (harmless if none)
    res.cookies.set("qrest_user", "", { path: "/", maxAge: 0 });

    res.cookies.set("qrest_user", JSON.stringify(session), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Set a lifetime if you want "remember me"; else omit maxAge for session cookie
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (e) {
    console.error("POST /api/auth/login ERROR:", e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
