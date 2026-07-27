export const maxDuration = 60;

import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { runDocGraph } from "@/lib/langgraph";
import { sanitizeInput, detectInjection } from "@/lib/security/guardrails";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, documentId, documentContent, organizationId, conversationId } = body;

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const orgId = organizationId || "demo";
    const sanitized = sanitizeInput(message);
    if (detectInjection(sanitized)) {
      return NextResponse.json({ reply: "Desculpe, não posso processar essa mensagem." });
    }

    const result = await runDocGraph({
      messages: [new HumanMessage(sanitized)],
      organizationId: orgId,
      documentId: documentId ?? "",
      documentContent: documentContent ?? "",
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
