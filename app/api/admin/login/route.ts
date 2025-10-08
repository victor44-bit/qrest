import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateAdminCreds } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "");
    const password = String(body?.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (!validateAdminCreds(email, password)) {
      return NextResponse.json({ error: "Invalid admin credentials" }, { status: 401 });
    }
    cookies().set("qrest_admin", "1", { httpOnly: true, sameSite: "lax", path: "/" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/admin/login error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
