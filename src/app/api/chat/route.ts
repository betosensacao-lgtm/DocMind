export const maxDuration = 60;

import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { runDocGraph } from "@/lib/langgraph";
import { sanitizeInput, detectInjection } from "@/lib/security/guardrails";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, documentId, documentContent, compareDocumentId, compareDocumentContent, conversationId } = body;

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    let orgId = "demo";
    let safeDocumentId = "";
    let safeDocumentContent = "";
    let safeCompareDocumentId = "";
    let safeCompareDocumentContent = "";

    // documentId/compareDocumentId only flow through with a verified session that
    // owns each document — otherwise qaNode's vector lookup, processorNode's chunk
    // insert, and now comparatorNode would let an unauthenticated caller read or
    // poison any organization's document just by guessing its id.
    if (documentId || compareDocumentId) {
      const session = await getSessionFromRequest(request);
      if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      orgId = session.organizationId;

      if (documentId) {
        const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
        if (!doc || doc.organizationId !== session.organizationId) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        safeDocumentId = documentId;
        safeDocumentContent = documentContent ?? "";
      }

      if (compareDocumentId) {
        const [compareDoc] = await db.select().from(documents).where(eq(documents.id, compareDocumentId));
        if (!compareDoc || compareDoc.organizationId !== session.organizationId) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        safeCompareDocumentId = compareDocumentId;
        safeCompareDocumentContent = compareDocumentContent ?? "";
      }
    }

    const sanitized = sanitizeInput(message);
    if (detectInjection(sanitized)) {
      return NextResponse.json({ reply: "Desculpe, não posso processar essa mensagem." });
    }

    const result = await runDocGraph({
      messages: [new HumanMessage(sanitized)],
      organizationId: orgId,
      documentId: safeDocumentId,
      documentContent: safeDocumentContent,
      compareDocumentId: safeCompareDocumentId,
      compareDocumentContent: safeCompareDocumentContent,
    }, conversationId);

    const messages = result.messages || [];
    const lastMsg = messages[messages.length - 1];

    let reply = "";
    if (typeof lastMsg?.content === "string" && lastMsg.content.trim() && !lastMsg.content.startsWith("[Intent:")) {
      reply = lastMsg.content;
    } else if (result.summary) {
      reply = result.summary;
    } else {
      // Find any message with string content
      for (let i = messages.length - 1; i >= 0; i--) {
        const text = messages[i]?.content;
        if (typeof text === "string" && text.trim() && !text.startsWith("[Intent:")) {
          reply = text;
          break;
        }
      }
    }

    if (!reply) {
      reply = result.summary || "Documento analisado com sucesso.";
    }

    return NextResponse.json({
      reply,
      summary: result.summary,
      extractions: result.extractionResults,
      conversationId: conversationId ?? crypto.randomUUID(),
    });
  } catch (error) {
    console.error("[CHAT ERROR]", error);
    return NextResponse.json({ error: "Erro interno no servidor ao consultar o documento" }, { status: 500 });
  }
}
