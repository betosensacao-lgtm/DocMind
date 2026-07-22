import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { CHAT_MODEL, AI_BASE_URL, AI_API_KEY } from "@/lib/ai";
import { chunkText } from "@/lib/documents/parser";
import { extractTools, summaryTools, qaTools } from "./tools";
import type { DocState } from "./state";

function createLLM(temperature = 0, maxTokens = 1024) {
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
- EXTRACT: User wants to extract specific data from a document
- SUMMARIZE: User wants a document summary
- QUESTION: User has a question about the document
- COMPARE: User wants to compare multiple documents
- UNKNOWN: Cannot determine intent
Respond ONLY with the intent name.`;

const EXTRACT_PROMPT = `You are a document data extraction specialist. Analyze the document content and extract structured information.

Identify key fields like: names, dates, amounts, contract terms, addresses, IDs, etc.

Use the extract_field tool for each piece of data you find. Extract all relevant fields.`;

const SUMMARY_PROMPT = `You are a document summarization specialist. Create a clear, concise summary of the document.

Include:
- Document type and purpose
- Key parties involved
- Important dates and values
- Main clauses or sections
- Critical findings or decisions

Use the generate_summary tool when complete.`;

const QA_PROMPT = `You are a document Q&A specialist. Answer questions based ONLY on the provided document content.

If the answer cannot be found in the document, say so clearly. Use the answer_question tool to provide your response with supporting sources.`;

export async function routerNode(state: typeof DocState.State) {
  const llm = createLLM(0, 20);
  const last = state.messages[state.messages.length - 1]?.content ?? "";
  try {
    const r = await llm.invoke([new SystemMessage(ROUTER_PROMPT), new HumanMessage(String(last))]);
    const intent = r.content.toString().trim().toUpperCase();
    const valid = ["PROCESS", "EXTRACT", "SUMMARIZE", "QUESTION", "COMPARE", "UNKNOWN"];
    return { messages: [new AIMessage(`[Intent: ${intent}]`)], error: valid.includes(intent) ? null : "UNKNOWN" };
  } catch { return { messages: [new AIMessage("[Intent: UNKNOWN]")], error: "UNKNOWN" }; }
}

export async function processorNode(state: typeof DocState.State) {
  const content = state.documentContent;
  const chunks = chunkText(content, 1500);
  return {
    messages: [new AIMessage(`Document processed: ${chunks.length} chunks extracted.`)],
    conversationSummary: `Document has ${chunks.length} sections. Ready for analysis.`,
  };
}

export async function extractorNode(state: typeof DocState.State) {
  const llm = createLLM(0.1, 2048).bindTools(extractTools);
  const contentPreview = state.documentContent.slice(0, 8000);
  const r = await llm.invoke([new SystemMessage(EXTRACT_PROMPT), new HumanMessage(contentPreview)]);
  const results: Record<string, string> = {};
  if (r.tool_calls) {
    for (const tc of r.tool_calls) {
      if (tc.name === "extract_field") {
        const args = JSON.parse(JSON.stringify(tc.args));
        results[args.fieldName] = args.fieldValue;
      }
    }
  }
  return { messages: [r], extractionResults: results };
}

export async function summarizerNode(state: typeof DocState.State) {
  const llm = createLLM(0.2, 2048).bindTools(summaryTools);
  const contentPreview = state.documentContent.slice(0, 6000);
  const r = await llm.invoke([new SystemMessage(SUMMARY_PROMPT), new HumanMessage(contentPreview)]);
  let summary = "";
  if (r.tool_calls) {
    for (const tc of r.tool_calls) {
      if (tc.name === "generate_summary") {
        const args = JSON.parse(JSON.stringify(tc.args));
        summary = args.summary;
      }
    }
  }
  return { messages: [r], summary };
}

export async function qaNode(state: typeof DocState.State) {
  const llm = createLLM(0.1, 2048).bindTools(qaTools);
  const contentPreview = state.documentContent.slice(0, 6000);
  const lastMsg = state.messages[state.messages.length - 1]?.content ?? "";
  const r = await llm.invoke([new SystemMessage(QA_PROMPT), new HumanMessage(`Document:\n${contentPreview}\n\nQuestion: ${lastMsg}`)]);
  return { messages: [r] };
}
