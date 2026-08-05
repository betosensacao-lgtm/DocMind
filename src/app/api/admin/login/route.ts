import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, verifyPassword, createSessionToken, updateLastLogin, hashPassword } from "@/lib/auth";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });

    const cleanEmail = email.trim().toLowerCase();
    let user = await getUserByEmail(cleanEmail).catch(() => null);

    // Bootstrap: only auto-creates the first admin when there is truly
    // no user at all in the database (very first login in production).
    if (!user) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const isBootstrap = Number(count) === 0;

      if (isBootstrap) {
        try {
          let orgList = await db.select().from(organizations).limit(1);
          let org = orgList[0];
          if (!org) {
            [org] = await db.insert(organizations).values({
              name: "DocMind Org",
              slug: `docmind-${Date.now()}`,
            } as any).returning();
          }

          const passwordHash = await hashPassword(password);
          const [newUser] = await db.insert(users).values({
            organizationId: org.id,
            email: cleanEmail,
            name: cleanEmail.split("@")[0],
            role: "admin",
            passwordHash,
            active: true,
          } as any).returning();
          user = newUser;
        } catch (insertErr) {
          console.warn("[BOOTSTRAP ADMIN CREATE WARN]", insertErr);
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Verify password — fail closed: any verification error denies the login.
    const isValid = await verifyPassword(password, user.passwordHash).catch(() => false);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ error: "User deactivated" }, { status: 403 });
    }

    const token = await createSessionToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    });

    await updateLastLogin(user.id).catch(() => null);

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });

    const cookieStore = await cookies();
    cookieStore.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });

    return response;
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
