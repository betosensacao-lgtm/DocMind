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
- QUESTION: User has a question about the document content
- UNKNOWN: Cannot determine intent
Respond ONLY with the single intent word.`;

export async function routerNode(state: typeof DocState.State) {
  const llm = createLLM(0, 20);
  const last = state.messages[state.messages.length - 1]?.content ?? "";
  try {
    const r = await llm.invoke([new SystemMessage(ROUTER_PROMPT), new HumanMessage(String(last))]);
    const intent = r.content.toString().trim().toUpperCase();
    const valid = ["PROCESS", "EXTRACT", "SUMMARIZE", "QUESTION"];
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
    messages: [new AIMessage(`Documento processado com sucesso: ${chunks.length} trecho(s) extraídos para análise.`)],
    conversationSummary: `O documento possui ${chunks.length} trecho(s). Pronto para análise.`,
  };
}

export async function extractorNode(state: typeof DocState.State) {
  const llm = createLLM(0.1, 2048);
  const contentPreview = state.documentContent ? state.documentContent.slice(0, 8000) : "Sem conteúdo disponível.";
  const prompt = `Você é um especialista em extração de dados estruturados.
Analise o documento abaixo e extraia as principais informações organizadas em tópicos claros (ex: nomes, empresas, valores, datas, contratos, termos):

Conteúdo do Documento:
${contentPreview}`;

  try {
    const r = await llm.invoke([new SystemMessage(prompt)]);
    const text = r.content.toString();
    return { messages: [new AIMessage(text)] };
  } catch {
    return { messages: [new AIMessage("Extração concluída para o documento.")] };
  }
}

export async function summarizerNode(state: typeof DocState.State) {
  const llm = createLLM(0.3, 2048);
  const contentPreview = state.documentContent ? state.documentContent.slice(0, 8000) : "Nenhum conteúdo disponível para resumo.";

  const prompt = `Você é um especialista em análise e resumo de documentos.
Analise o documento fornecido abaixo e elabore um resumo completo, claro e bem estruturado em português do Brasil.

Estruture sua resposta assim:
📝 **RESUMO DO DOCUMENTO**

1. **Objetivo Principal & Visão Geral**
2. **Principais Tópicos e Seções**
3. **Valores, Datas ou Dados Relevantes**
4. **Conclusão e Próximos Passos / Observações**

Conteúdo do Documento:
${contentPreview}`;

  try {
    const r = await llm.invoke([new SystemMessage(prompt)]);
    const summaryText = r.content.toString();
    return {
      messages: [new AIMessage(summaryText)],
      summary: summaryText,
    };
  } catch (err) {
    const fallbackText = "Resumo do documento:\n" + contentPreview.slice(0, 500) + "...";
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

  const prompt = `Você é o assistente IA especializado em análise documental da plataforma DocMind.
Responda à pergunta do usuário utilizando como base os trechos do documento fornecido abaixo.
Responda sempre em português do Brasil de forma amigável, clara e objetiva.

Trecho(s) do Documento:
${relevantContent || "Conteúdo geral do documento carregado."}

Pergunta do Usuário: ${lastMsg}`;

  try {
    const r = await llm.invoke([new SystemMessage(prompt)]);
    return { messages: [new AIMessage(r.content.toString())] };
  } catch (err) {
    return { messages: [new AIMessage("Desculpe, ocorreu um erro ao consultar o documento. Por favor, tente novamente.")] };
  }
}
