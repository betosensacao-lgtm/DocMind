import fs from "fs";
import path from "path";

export async function parseDocument(filePath: string, mimeType: string): Promise<{ text: string; pages: number }> {
  if (mimeType === "application/pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return { text: data.text, pages: data.numpages };
    } catch (err) {
      console.error("[PDF PARSE ERROR]", err);
      return { text: "", pages: 0 };
    }
  }

  if (mimeType.startsWith("text/")) {
    const text = fs.readFileSync(filePath, "utf-8");
    return { text, pages: 1 };
  }

  return { text: "", pages: 0 };
}

export function chunkText(text: string, maxChunkSize = 1000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = "";

  for (const p of paragraphs) {
    if ((current + p).length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current += (current ? "\n\n" : "") + p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, maxChunkSize)];
}
