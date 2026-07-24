import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { googleConnections } from "@/db/schema";
import { db } from "@/db";
import { verifySessionToken } from "@/lib/auth";
import { getOAuthDriveClient } from "@/lib/google";
import { listFiles } from "@/lib/google/drive";

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get("admin_session");
    if (!cookie) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const session = await verifySessionToken(cookie.value);
    const [connection] = await db.select().from(googleConnections).where(eq(googleConnections.userId, session.userId)).limit(1);
    if (!connection) return NextResponse.json({ error: "Connect Google Drive first" }, { status: 400 });

    const drive = await getOAuthDriveClient({
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.expiresAt,
      scope: connection.scope,
      email: connection.email,
    });

    const files = await listFiles(drive, "mimeType!='application/vnd.google-apps.folder' and (mimeType contains 'pdf' or mimeType contains 'text' or mimeType contains 'document')");
    return NextResponse.json({ files });
  } catch (error) {
    console.error("[DRIVE LIST ERROR]", error);
    return NextResponse.json({ error: "Failed to list Drive files" }, { status: 500 });
  }
}
