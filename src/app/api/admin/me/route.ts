import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: session.userId,
    name: session.email?.split("@")[0] || "Admin",
    email: session.email,
    role: session.role,
    organizationId: session.organizationId,
  });
}
