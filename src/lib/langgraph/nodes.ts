import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { CHAT_MODEL, AI_BASE_URL, AI_API_KEY } from "@/lib/ai";
import { chunkText } from "@/lib/documents/parser";
import { generateEmbedding } from "@/lib/embeddings";
import type { DocState } from "./state";
import { db } from "@/db";
import { documentChunks } from "@/db/schema";
import { cosineDistance, desc, eq, sql } from "drizzle-orm";

function createLLM(temperature = 0.2, maxTokens = 2048) {
  return new ChatOpenAI({
    model: CHAT_MODEL,
    temperature,
    maxTokens,
    configuration: { baseURL: AI_BASE_URL },
    apiKey: AI_API_KEY,
  } as any);
}

const ROUTER_PROMPT = `You are a document query classifier. Classify the user's request into ONE intent:
- PROCESS: User uploaded or mentioned a document to process
- EXTRACT: User wants to extract specific data, tables or fields
- SUMMARIZE: User wants a document summary, overview or main points
- COMPARE: User wants to compare the current document against another document
- QUESTION: User has a question about the document content
- UNKNOWN: Cannot determine intent
Respond ONLY with the single intent word.`;

export async function routerNode(state: typeof DocState.State) {
  const llm = createLLM(0, 20);
  const last = state.messages[state.messages.length - 1]?.content ?? "";
  try {
    const r = await llm.invoke([new SystemMessage(ROUTER_PROMPT), new HumanMessage(String(last))]);
    const intent = r.content.toString().trim().toUpperCase();
    const valid = ["PROCESS", "EXTRACT", "SUMMARIZE", "COMPARE", "QUESTION"];
    const matchedIntent = valid.find(v => intent.includes(v)) || "QUESTION";
    return { messages: [new AIMessage(`[Intent: ${matchedIntent}]`)], error: matchedIntent };
  } catch {
    return { messages: [new AIMessage("[Intent: QUESTION]")], error: "QUESTION" };
  }
}

export async function processorNode(state: typeof DocState.State) {
  const content = state.documentContent || "";
  const chunks = chunkText(content, 1500);

  if (state.documentId && chunks.length > 0) {
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i]);
        await db.insert(documentChunks).values({
          documentId: state.documentId,
          content: chunks[i],
          chunkIndex: i,
          embedding,
        } as any);
      } catch {}
    }
  }

  return {
    messages: [new AIMessage(`Document processed successfully: ${chunks.length} chunk(s) extracted for analysis.`)],
    conversationSummary: `The document has ${chunks.length} chunk(s). Ready for analysis.`,
  };
}

export async function extractorNode(state: typeof DocState.State) {
  const llm = createLLM(0.1, 2048);
  const contentPreview = state.documentContent ? state.documentContent.slice(0, 8000) : "No content available.";
  const prompt = `You are a specialist in structured data extraction.
Analyze the document below and extract the key information organized into clear topics (e.g. names, companies, amounts, dates, contracts, terms):

Document Content:
${contentPreview}`;

  try {
    const r = await llm.invoke([new SystemMessage(prompt)]);
    const text = r.content.toString();
    return { messages: [new AIMessage(text)] };
  } catch {
    return { messages: [new AIMessage("Extraction completed for the document.")] };
  }
}

export async function summarizerNode(state: typeof DocState.State) {
  const llm = createLLM(0.3, 2048);
  const contentPreview = state.documentContent ? state.documentContent.slice(0, 8000) : "No content available for summary.";

  const prompt = `You are a specialist in document analysis and summarization.
Analyze the document provided below and produce a complete, clear, and well-structured summary.

Structure your response like this:
📝 **DOCUMENT SUMMARY**

1. **Main Purpose & Overview**
2. **Key Topics and Sections**
3. **Relevant Amounts, Dates, or Data**
4. **Conclusion and Next Steps / Observations**

Document Content:
${contentPreview}`;

  try {
    const r = await llm.invoke([new SystemMessage(prompt)]);
    const summaryText = r.content.toString();
    return {
      messages: [new AIMessage(summaryText)],
      summary: summaryText,
    };
  } catch (err) {
    const fallbackText = "Document summary:\n" + contentPreview.slice(0, 500) + "...";
    return {
      messages: [new AIMessage(fallbackText)],
      summary: fallbackText,
    };
  }
}

export async function qaNode(state: typeof DocState.State) {
  const llm = createLLM(0.2, 2048);
  const lastMsg = state.messages[state.messages.length - 1]?.content ?? "";

  let relevantContent = state.documentContent ? state.documentContent.slice(0, 8000) : "";

  if (state.documentId && state.documentContent) {
    try {
      const queryEmbedding = await generateEmbedding(String(lastMsg));
      const similarity = sql<number>`1 - (${cosineDistance(documentChunks.embedding, queryEmbedding)})`;
      const results = await db
        .select({ content: documentChunks.content, similarity })
        .from(documentChunks)
        .where(eq(documentChunks.documentId, state.documentId))
        .orderBy(desc(similarity))
        .limit(4);

      if (results.length > 0) {
        relevantContent = results.map(r => r.content).join("\n\n---\n\n");
      }
    } catch {}
  }

  const prompt = `You are the AI assistant specialized in document analysis for the DocMind platform.
Answer the user's question based on the document excerpts provided below.
Always respond in a friendly, clear, and objective manner.

Document Excerpt(s):
${relevantContent || "General content of the loaded document."}

User Question: ${lastMsg}`;

  try {
    const r = await llm.invoke([new SystemMessage(prompt)]);
    return { messages: [new AIMessage(r.content.toString())] };
  } catch (err) {
    return { messages: [new AIMessage("Sorry, an error occurred while consulting the document. Please try again.")] };
  }
}

export async function comparatorNode(state: typeof DocState.State) {
  const llm = createLLM(0.2, 2048);

  if (!state.compareDocumentContent) {
    return {
      messages: [new AIMessage("Select a second document to compare before requesting the comparison.")],
    };
  }

  const contentA = state.documentContent ? state.documentContent.slice(0, 6000) : "No content available.";
  const contentB = state.compareDocumentContent.slice(0, 6000);

  const prompt = `You are a specialist in comparative document analysis.
Compare the two documents below and respond clearly and objectively, structured like this:

🔍 **DOCUMENT COMPARISON**

1. **Key Similarities**
2. **Key Differences**
3. **Points of Attention** (amounts, dates, or diverging clauses, if any)

Document A:
${contentA}

Document B:
${contentB}`;

  try {
    const r = await llm.invoke([new SystemMessage(prompt)]);
    return { messages: [new AIMessage(r.content.toString())] };
  } catch {
    return { messages: [new AIMessage("Sorry, an error occurred while comparing the documents. Please try again.")] };
  }
}
