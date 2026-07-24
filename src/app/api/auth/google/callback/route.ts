import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getTokensFromCode } from "@/lib/google";
import { googleConnections } from "@/db/schema";
import { db } from "@/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const googleError = searchParams.get("error");

    if (googleError) {
      return NextResponse.redirect(new URL("/admin?google=error", request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/admin?google=no_code", request.url));
    }

    const tokens = await getTokensFromCode(code);

    // TODO: get userId from session
    const userId = "system";

    const existing = await db
      .select()
      .from(googleConnections)
      .where(eq(googleConnections.userId, userId))
      .limit(1);

    const base = {
      email: tokens.email,
      scope: tokens.scope,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    };

    if (existing.length > 0) {
      await db
        .update(googleConnections)
        .set({ ...base, updatedAt: new Date() } as any)
        .where(eq(googleConnections.userId, userId));
    } else {
      await db.insert(googleConnections).values({ userId, ...base } as any);
    }

    return NextResponse.redirect(new URL("/admin?google=connected", request.url));
  } catch (error) {
    console.error("[GOOGLE CALLBACK ERROR]", error);
    return NextResponse.redirect(new URL("/admin?google=error", request.url));
  }
}
