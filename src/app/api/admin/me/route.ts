import { NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

export async function GET(request: Request) {
  const cookie = (request.headers.get("cookie") || "")
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!cookie) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const session = await verifySessionToken(cookie);
    return NextResponse.json({
      id: session.userId,
      name: session.email?.split("@")[0] || "Admin",
      email: session.email,
      role: session.role,
      organizationId: session.organizationId,
    });
  } catch {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
}
