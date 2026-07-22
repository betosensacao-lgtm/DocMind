import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { runDocGraph } from "@/lib/langgraph";
import { sanitizeInput, detectInjection } from "@/lib/security/guardrails";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";

export async function POST(request: Request) {
  try {
    const { message, documentId, documentContent, organizationId, conversationId } = await request.json();
    if (!message || !organizationId) {
      return NextResponse.json({ error: "message and organizationId required" }, { status: 400 });
    }
    const sanitized = sanitizeInput(message);
    if (detectInjection(sanitized)) {
      return NextResponse.json({ reply: "Sorry, I cannot process that message." });
    }

    const result = await runDocGraph({
      messages: [new HumanMessage(sanitized)],
      organizationId,
      documentId: documentId ?? "",
      documentContent: documentContent ?? "",
    }, conversationId);

    const lastMsg = result.messages[result.messages.length - 1];
    const reply = typeof lastMsg?.content === "string" ? lastMsg.content : "";

    return NextResponse.json({
      reply,
      summary: result.summary,
      extractions: result.extractionResults,
      conversationId: conversationId ?? crypto.randomUUID(),
    });
  } catch (error) {
    console.error("[CHAT ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
