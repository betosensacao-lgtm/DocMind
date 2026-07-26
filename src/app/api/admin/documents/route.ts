import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const organizationId = request.headers.get("x-organization-id");

    const query = db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        status: documents.status,
        pageCount: documents.pageCount,
        createdAt: documents.createdAt,
      })
      .from(documents);

    const result = organizationId
      ? await query.where(eq(documents.organizationId, organizationId)).orderBy(documents.createdAt)
      : await query.orderBy(documents.createdAt);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ADMIN DOCS GET ERROR]", error);
    return NextResponse.json([]);
  }
}
