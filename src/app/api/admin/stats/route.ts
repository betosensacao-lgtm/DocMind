import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, extractions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const orgId = request.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const [totalDocs] = await db.select({ count: sql<number>`count(*)` }).from(documents).where(eq(documents.organizationId, orgId));
  const [readyDocs] = await db.select({ count: sql<number>`count(*)` }).from(documents).where(and(eq(documents.organizationId, orgId), eq(documents.status, "READY")));
  const [totalExtractions] = await db.select({ count: sql<number>`count(*)` }).from(extractions);

  return NextResponse.json({
    totalDocuments: Number(totalDocs.count),
    readyDocuments: Number(readyDocs.count),
    totalExtractions: Number(totalExtractions.count),
  });
}
