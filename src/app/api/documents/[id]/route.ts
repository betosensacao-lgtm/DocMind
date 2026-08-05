import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentChunks, extractions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc || doc.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

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
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc || doc.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(extractions).where(eq(extractions.documentId, id));
    await db.delete(documentChunks).where(eq(documentChunks.documentId, id));
    await db.delete(documents).where(eq(documents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE DOC ERROR]", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
