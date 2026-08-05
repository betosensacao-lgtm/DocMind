import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, extractions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [totalDocs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(eq(documents.organizationId, session.organizationId));

    const [readyDocs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(eq(documents.organizationId, session.organizationId), eq(documents.status, "READY")));

    const [totalExtractions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(extractions)
      .innerJoin(documents, eq(extractions.documentId, documents.id))
      .where(eq(documents.organizationId, session.organizationId));

    return NextResponse.json({
      totalDocuments: Number(totalDocs?.count ?? 0),
      readyDocuments: Number(readyDocs?.count ?? 0),
      totalExtractions: Number(totalExtractions?.count ?? 0),
    });
  } catch (error) {
    console.error("[ADMIN STATS GET ERROR]", error);
    return NextResponse.json({
      totalDocuments: 0,
      readyDocuments: 0,
      totalExtractions: 0,
    });
  }
}
