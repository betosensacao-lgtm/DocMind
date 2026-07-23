export const maxDuration = 60;

import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { runDocGraph } from "@/lib/langgraph";
import { sanitizeInput, detectInjection } from "@/lib/security/guardrails";
import { supabase } from "@/lib/supabase/client";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const reqBody = await request.json();
    console.log("[N8N DOCMIND PAYLOAD RECEBIDO]:", reqBody); 
    
    const data = reqBody.body ? reqBody.body : reqBody;

    const organizationId = reqBody.organizationId || data.organizationId || "org_default_docmind";
    const conversationId = reqBody.conversationId || data.conversationId || crypto.randomUUID();
    const prompt = reqBody.prompt || data.prompt || "Analise e processe este documento.";
    const documentContent = reqBody.documentContent || data.documentContent || "";
    const fileName = reqBody.fileName || data.fileName || "documento_n8n.txt";

    if (!documentContent) {
      return NextResponse.json(
        { status: "error", message: "Missing required field: documentContent" },
        { status: 400 }
      );
    }

    const sanitizedPrompt = sanitizeInput(prompt);
    if (detectInjection(sanitizedPrompt)) {
      return NextResponse.json({ reply: "Sorry, I cannot process that prompt.", status: "error" });
    }

    // 1. Upload file to Supabase Storage
    const storagePath = `${organizationId}/${conversationId}_${fileName}`;
    
    // If documentContent is base64 we should convert it, but assuming it is just text for now:
    const fileBuffer = Buffer.from(documentContent, 'utf-8');
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("docmind_documents")
      .upload(storagePath, fileBuffer, {
        contentType: "text/plain", // Default to text, ideally dynamic
        upsert: true
      });

    if (uploadError) {
      console.error("[STORAGE UPLOAD ERROR]", uploadError);
      // We don't fail the request, just log it. Or we could fail it.
    } else {
      console.log(`[STORAGE] Uploaded to docmind_documents/${storagePath}`);
    }

    // 2. Call DocMind LangGraph
    const result = await runDocGraph({
      messages: [new HumanMessage(sanitizedPrompt)],
      organizationId: organizationId,
      documentContent: documentContent,
      fileName: fileName
    }, conversationId);

    const lastMsg = result.messages[result.messages.length - 1];
    const reply = typeof lastMsg?.content === "string" ? lastMsg.content : "";

    return NextResponse.json({ 
      status: "ok", 
      message: "Document processed by LangGraph",
      reply: reply,
      summary: result.summary,
      extractions: result.extractionResults,
      conversationId: conversationId
    });

  } catch (error) {
    console.error("[N8N WEBHOOK ERROR]", error);
    return NextResponse.json(
      { status: "error", message: "Internal server error" }, 
      { status: 500 }
    );
  }
}
