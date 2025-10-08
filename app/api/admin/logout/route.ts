import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  cookies().delete("qrest_admin");
  return NextResponse.json({ ok: true });
}
