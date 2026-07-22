import { NextResponse } from "next/server";
import { getUserById } from "@/lib/auth";
export async function GET(request: Request) {
  const userId = request.headers.get("x-user-id");
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId });
}
