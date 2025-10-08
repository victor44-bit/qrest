import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, origin } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    const isAdmin = req.cookies.get("qrest_admin")?.value === "1";
    if (!isAdmin && !pathname.startsWith("/admin/login")) {
      const url = new URL("/admin/login", origin);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
