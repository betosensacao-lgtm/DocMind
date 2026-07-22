import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth";

const publicRoutes = ["/admin/login", "/admin/signup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (publicRoutes.some((r) => pathname.startsWith(r))) return NextResponse.next();

  const sessionCookie = request.cookies.get("admin_session")?.value;
  if (!sessionCookie) return NextResponse.redirect(new URL("/admin/login", request.url));

  try {
    const session = await verifySessionToken(sessionCookie);
    const headers = new Headers(request.headers);
    headers.set("x-user-id", session.userId);
    headers.set("x-user-email", session.email);
    headers.set("x-user-role", session.role);
    headers.set("x-organization-id", session.organizationId);
    return NextResponse.next({ headers });
  } catch {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
}

export const config = { matcher: "/admin/:path*" };
