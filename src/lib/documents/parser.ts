import fs from "fs";
import path from "path";

export async function parseDocument(filePath: string, mimeType: string): Promise<{ text: string; pages: number }> {
  const ext = path.extname(filePath).toLowerCase();

  // 1. PDF Documents
  if (mimeType === "application/pdf" || ext === ".pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return { text: data.text, pages: data.numpages || 1 };
    } catch (err) {
      console.error("[PDF PARSE ERROR]", err);
      // Fallback: try raw string extraction if pdf-parse fails
      const buffer = fs.readFileSync(filePath);
      const rawText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      return { text: rawText.slice(0, 10000), pages: 1 };
    }
  }

  // 2. DOCX Documents
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ path: filePath });
      return { text: result.value, pages: Math.ceil(result.value.length / 3000) || 1 };
    } catch (err) {
      console.warn("[DOCX MAMMOTH PARSE WARN] Falling back to text extraction:", err);
      const buffer = fs.readFileSync(filePath);
      const text = buffer.toString("utf-8").replace(/<[^>]+>/g, " ").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      return { text, pages: 1 };
    }
  }

  // 3. Excel & CSV Spreadsheets (.xlsx, .csv)
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv" ||
    ext === ".csv" ||
    ext === ".xlsx"
  ) {
    try {
      if (ext === ".xlsx" || mimeType.includes("spreadsheet")) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.readFile(filePath);
        const sheetNames = workbook.SheetNames;
        let fullText = "";

        for (const name of sheetNames) {
          const sheet = workbook.Sheets[name];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          fullText += `--- Sheet: ${name} ---\n${csv}\n\n`;
        }

        return { text: fullText, pages: sheetNames.length };
      } else {
        const text = fs.readFileSync(filePath, "utf-8");
        return { text, pages: 1 };
      }
    } catch (err) {
      console.warn("[SPREADSHEET PARSE WARN] Reading as plain text:", err);
      const text = fs.readFileSync(filePath, "utf-8");
      return { text, pages: 1 };
    }
  }

  // 4. Plain Text, Markdown, JSON, Code files
  if (
    mimeType.startsWith("text/") ||
    [".md", ".markdown", ".json", ".txt", ".csv", ".log"].includes(ext)
  ) {
    try {
      const text = fs.readFileSync(filePath, "utf-8");
      return { text, pages: Math.ceil(text.length / 3000) || 1 };
    } catch (err) {
      console.error("[TEXT PARSE ERROR]", err);
      return { text: "", pages: 0 };
    }
  }

  // Fallback for any other readable text
  try {
    const text = fs.readFileSync(filePath, "utf-8");
    return { text, pages: 1 };
  } catch {
    return { text: "", pages: 0 };
  }
}

export function chunkText(text: string, maxChunkSize = 1000): string[] {
  if (!text || !text.trim()) return [];

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
