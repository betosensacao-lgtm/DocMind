import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { googleConnections, documents, documentChunks } from "@/db/schema";
import { db } from "@/db";
import { verifySessionToken } from "@/lib/auth";
import { getOAuthDriveClient } from "@/lib/google";
import { downloadFile } from "@/lib/google/drive";
import { parseDocument, chunkText } from "@/lib/documents/parser";
import { getEmbedding } from "@/lib/rag";

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get("admin_session");
    if (!cookie) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const session = await verifySessionToken(cookie.value);
    const { fileId, fileName, mimeType } = await request.json();
    if (!fileId) return NextResponse.json({ error: "fileId required" }, { status: 400 });

    const [connection] = await db.select().from(googleConnections).where(eq(googleConnections.userId, session.userId)).limit(1);
    if (!connection) return NextResponse.json({ error: "Connect Google Drive first" }, { status: 400 });

    const drive = await getOAuthDriveClient({
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      expiresAt: connection.expiresAt,
      scope: connection.scope,
      email: connection.email,
    });

    const stream = await downloadFile(drive, fileId, mimeType) as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const uploadDir = process.env.UPLOAD_DIR ?? "data/uploads";
    await mkdir(uploadDir, { recursive: true });
    const ext = path.extname(fileName) || ".pdf";
    const localName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, localName);
    await writeFile(filePath, buffer);

    const { text, pages } = await parseDocument(filePath, mimeType);

    const [doc] = await db.insert(documents).values({
      organizationId: session.organizationId,
      fileName: fileName,
      fileType: mimeType,
      fileSize: buffer.length,
      filePath,
      pageCount: pages,
      textContent: text,
      status: "PROCESSING",
    } as any).returning();

    if (text) {
      const textChunks = chunkText(text, 1000);
      for (let i = 0; i < textChunks.length; i++) {
        const embedding = await getEmbedding(textChunks[i]);
        await db.insert(documentChunks).values({
          documentId: doc.id,
          content: textChunks[i],
          embedding: embedding.length ? JSON.stringify(embedding) : null,
          chunkIndex: i,
        } as any);
      }
      await db.update(documents).set({ status: "READY", processedAt: new Date() } as any).where(eq(documents.id, doc.id));
    }

    return NextResponse.json({ id: doc.id, fileName, status: "READY", textLength: text.length });
  } catch (error) {
    console.error("[DRIVE IMPORT ERROR]", error);
    return NextResponse.json({ error: "Failed to import from Drive" }, { status: 500 });
  }
}
