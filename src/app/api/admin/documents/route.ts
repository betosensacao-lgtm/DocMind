import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const organizationId = request.headers.get("x-organization-id");
  if (!organizationId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const result = await db
    .select({ id: documents.id, fileName: documents.fileName, fileType: documents.fileType, fileSize: documents.fileSize, status: documents.status, pageCount: documents.pageCount, createdAt: documents.createdAt })
    .from(documents)
    .where(eq(documents.organizationId, organizationId))
    .orderBy(documents.createdAt);

  return NextResponse.json(result);
}
