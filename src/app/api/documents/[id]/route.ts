import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentChunks, extractions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orgId = request.headers.get("x-organization-id") || "default-org";

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const chunks = await db.select().from(documentChunks).where(eq(documentChunks.documentId, id)).orderBy(documentChunks.chunkIndex);
    const extracted = await db.select().from(extractions).where(eq(extractions.documentId, id));

    return NextResponse.json({
      ...doc,
      chunks,
      extractions: extracted
    });
  } catch (error) {
    console.error("[GET DOC ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await db.delete(extractions).where(eq(extractions.documentId, id));
    await db.delete(documentChunks).where(eq(documentChunks.documentId, id));
    await db.delete(documents).where(eq(documents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE DOC ERROR]", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
