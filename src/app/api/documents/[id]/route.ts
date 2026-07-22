import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentChunks, extractions, conversations, messages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const orgId = request.headers.get("x-organization-id");
  const { id } = await params;
  if (!orgId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc || doc.organizationId !== orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const chunks = await db.select().from(documentChunks).where(eq(documentChunks.documentId, id)).orderBy(documentChunks.chunkIndex);
  const extracted = await db.select().from(extractions).where(eq(extractions.documentId, id));

  return NextResponse.json({ document: doc, chunks, extractions: extracted });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const orgId = request.headers.get("x-organization-id");
  const { id } = await params;
  if (!orgId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  await db.delete(extractions).where(eq(extractions.documentId, id));
  await db.delete(documentChunks).where(eq(documentChunks.documentId, id));
  await db.delete(documents).where(eq(documents.id, id));

  return NextResponse.json({ success: true });
}
