import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { parseDocument, chunkText } from "@/lib/documents/parser";
import { getEmbedding } from "@/lib/rag";

export async function POST(request: Request) {
  const orgId = request.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const uploadDir = process.env.UPLOAD_DIR ?? "data/uploads";
    await mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name);
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const mimeType = file.type || "application/octet-stream";
    const { text, pages } = await parseDocument(filePath, mimeType);

    const [doc] = await db.insert(documents).values({
      organizationId: orgId,
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      filePath,
      pageCount: pages,
      textContent: text,
      status: "PROCESSING",
    } as any).returning();

    if (text) {
      const chunks = chunkText(text, 1000);
      for (let i = 0; i < chunks.length; i++) {
        const embedding = await getEmbedding(chunks[i]);
        await db.insert(documentChunks).values({
          documentId: doc.id,
          content: chunks[i],
          embedding: embedding.length ? JSON.stringify(embedding) : null,
          chunkIndex: i,
        } as any);
      }

      await db.update(documents).set({ status: "READY", processedAt: new Date() } as any).where(eq(documents.id, doc.id));
    }

    return NextResponse.json({ id: doc.id, fileName: file.name, status: "READY", pageCount: pages, textLength: text.length }, { status: 201 });
  } catch (error) {
    console.error("[UPLOAD ERROR]", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const orgId = request.headers.get("x-organization-id");
  if (!orgId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

  const result = await db.select().from(documents).where(eq(documents.organizationId, orgId)).orderBy(documents.createdAt);
  return NextResponse.json(result);
}
