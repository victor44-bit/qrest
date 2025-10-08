import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const c = cookies().get("qrest_user");
  const user = c ? JSON.parse(c.value) : null;
  return NextResponse.json({ user });
}