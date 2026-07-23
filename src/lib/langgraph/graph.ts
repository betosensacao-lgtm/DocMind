import { StateGraph } from "@langchain/langgraph";
import { DocState } from "./state";
import { routerNode, processorNode, extractorNode, summarizerNode, qaNode } from "./nodes";
import { routeAfterRouter, routeAfterProcessor, routeAfterExtractor, routeAfterSummarizer, routeAfterQa } from "./edges";
import { getCheckpointer, ensureCheckpointerSetup } from "./persistence";

const wf = new StateGraph(DocState)
  .addNode("router", routerNode)
  .addNode("processor", processorNode)
  .addNode("extractor", extractorNode)
  .addNode("summarizer", summarizerNode)
  .addNode("qa", qaNode)
  .addEdge("__start__", "router")
  .addConditionalEdges("router", routeAfterRouter)
  .addConditionalEdges("processor", routeAfterProcessor)
  .addConditionalEdges("extractor", routeAfterExtractor)
  .addConditionalEdges("summarizer", routeAfterSummarizer)
  .addConditionalEdges("qa", routeAfterQa);

export const docGraph = wf.compile({ checkpointer: getCheckpointer() });

export async function runDocGraph(input: { messages: any[]; organizationId: string; documentId?: string; documentContent?: string; fileName?: string; fileType?: string }, threadId?: string) {
  await ensureCheckpointerSetup();
  return docGraph.invoke({
    messages: input.messages,
    organizationId: input.organizationId,
    documentId: input.documentId ?? "",
    documentContent: input.documentContent ?? "",
    fileName: input.fileName ?? "",
    fileType: input.fileType ?? "",
  }, { configurable: { thread_id: threadId ?? crypto.randomUUID() } });
}
