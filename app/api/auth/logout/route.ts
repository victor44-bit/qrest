// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("qrest_user", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // expire immediately
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
