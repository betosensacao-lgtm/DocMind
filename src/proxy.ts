import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicRoutes = ["/admin/login", "/admin/signup"];

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");

interface SessionPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (publicRoutes.some((r) => pathname.startsWith(r))) return NextResponse.next();

  const sessionCookie = request.cookies.get("admin_session")?.value;
  if (!sessionCookie) return NextResponse.redirect(new URL("/admin/login", request.url));

  try {
    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET);
    const session = payload as unknown as SessionPayload;
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
