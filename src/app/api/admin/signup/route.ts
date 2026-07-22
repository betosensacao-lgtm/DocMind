import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { hashPassword, createSessionToken } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { name, email, password, company } = await request.json();
    if (!name || !email || !password || !company) return NextResponse.json({ error: "All fields required" }, { status: 400 });
    if (password.length < 6) return NextResponse.json({ error: "Password must be 6+ characters" }, { status: 400 });

    const [org] = await db.insert(organizations).values({ name: company, slug: slugify(company) } as any).returning();
    const [user] = await db.insert(users).values({ organizationId: org.id, email, name, role: "admin", passwordHash: await hashPassword(password) } as any).returning();

    const token = await createSessionToken({ userId: user.id, organizationId: org.id, email: user.email, role: user.role });
    (await cookies()).set("admin_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 86400 });

    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error("[SIGNUP ERROR]", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}
