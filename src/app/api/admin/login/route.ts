import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserByEmail, verifyPassword, createSessionToken, updateLastLogin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

    const user = await getUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    if (!user.active) return NextResponse.json({ error: "User deactivated" }, { status: 403 });

    const token = await createSessionToken({ userId: user.id, organizationId: user.organizationId, email: user.email, role: user.role });
    await updateLastLogin(user.id);

    (await cookies()).set("admin_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400 });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
