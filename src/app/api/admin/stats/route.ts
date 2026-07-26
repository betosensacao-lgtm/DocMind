import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, extractions } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const [totalDocs] = await db.select({ count: sql<number>`count(*)` }).from(documents);
    const [readyDocs] = await db.select({ count: sql<number>`count(*)` }).from(documents);
    const [totalExtractions] = await db.select({ count: sql<number>`count(*)` }).from(extractions);

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
