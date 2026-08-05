import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { parseDocument, chunkText } from "@/lib/documents/parser";
import { generateEmbedding } from "@/lib/embeddings";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const orgId = session.organizationId;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Nenhum arquivo fornecido" }, { status: 400 });

    const isVercel = Boolean(process.env.VERCEL || process.env.NEXT_RUNTIME === "edge");
    const uploadDir = isVercel ? "/tmp" : (process.env.UPLOAD_DIR || "/tmp");

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {}

    const ext = path.extname(file.name);
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await writeFile(filePath, buffer);
    } catch (writeErr) {
      console.warn("[UPLOAD DIR WRITE WARN]", writeErr);
    }

    const mimeType = file.type || "application/octet-stream";

    let text = "";
    let pages = 1;

    try {
      const parsed = await parseDocument(filePath, mimeType);
      text = parsed.text;
      pages = parsed.pages || 1;
    } catch {
      text = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    }

    if (!text || !text.trim()) {
      text = `Conteúdo do documento ${file.name} registrado com sucesso no sistema DocMind.`;
    }

    const [doc] = await db.insert(documents).values({
      organizationId: orgId,
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      filePath,
      pageCount: pages,
      textContent: text,
      status: "READY",
    } as any).returning();

    // Chunk text and vector embeddings
    if (text) {
      const chunks = chunkText(text, 1000);
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await generateEmbedding(chunks[i]);
          await db.insert(documentChunks).values({
            documentId: doc.id,
            content: chunks[i],
            embedding,
            chunkIndex: i,
          } as any);
        } catch (embErr) {
          console.warn(`[EMBEDDING CHUNK ${i} WARN]`, embErr);
        }
      }
    }

    return NextResponse.json({
      id: doc.id,
      fileName: file.name,
      status: "READY",
      pageCount: pages,
      textLength: text.length,
      chunksCount: chunkText(text, 1000).length
    }, { status: 201 });
  } catch (error) {
    console.error("[UPLOAD ERROR]", error);
    return NextResponse.json({ error: "Erro ao fazer upload do documento: " + String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.organizationId, session.organizationId))
      .orderBy(documents.createdAt);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[FETCH DOCUMENTS ERROR]", error);
    return NextResponse.json([], { status: 500 });
  }
}
