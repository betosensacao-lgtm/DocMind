import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { googleConnections } from "@/db/schema";
import { db } from "@/db";
import { verifySessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get("admin_session");
    if (!cookie) throw new Error("No session");

    const session = await verifySessionToken(cookie.value);
    await db.delete(googleConnections).where(eq(googleConnections.userId, session.userId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[GOOGLE DISCONNECT ERROR]", error);
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
  }
}
