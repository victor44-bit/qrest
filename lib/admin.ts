import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.toLowerCase() || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export function validateAdminCreds(email: string, password: string) {
  return email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export function isAdmin() {
  return cookies().get("qrest_admin")?.value === "1";
}

export function requireAdmin() {
  if (!isAdmin()) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  return null;
}
