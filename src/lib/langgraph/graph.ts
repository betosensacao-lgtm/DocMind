import { StateGraph } from "@langchain/langgraph";
import { DocState } from "./state";
import { routerNode, processorNode, extractorNode, summarizerNode, qaNode, comparatorNode } from "./nodes";
import { routeAfterRouter, routeAfterProcessor, routeAfterExtractor, routeAfterSummarizer, routeAfterQa, routeAfterComparator } from "./edges";
import { getCheckpointer, ensureCheckpointerSetup } from "./persistence";

const wf = new StateGraph(DocState)
  .addNode("router", routerNode)
  .addNode("processor", processorNode)
  .addNode("extractor", extractorNode)
  .addNode("summarizer", summarizerNode)
  .addNode("qa", qaNode)
  .addNode("comparator", comparatorNode)
  .addEdge("__start__", "router")
  .addConditionalEdges("router", routeAfterRouter)
  .addConditionalEdges("processor", routeAfterProcessor)
  .addConditionalEdges("extractor", routeAfterExtractor)
  .addConditionalEdges("summarizer", routeAfterSummarizer)
  .addConditionalEdges("qa", routeAfterQa)
  .addConditionalEdges("comparator", routeAfterComparator);

export const docGraph = wf.compile({ checkpointer: getCheckpointer() });

export async function runDocGraph(input: {
  messages: any[];
  organizationId: string;
  documentId?: string;
  documentContent?: string;
  compareDocumentId?: string;
  compareDocumentContent?: string;
  fileName?: string;
  fileType?: string;
}, threadId?: string) {
  await ensureCheckpointerSetup();
  return docGraph.invoke({
    messages: input.messages,
    organizationId: input.organizationId,
    documentId: input.documentId ?? "",
    documentContent: input.documentContent ?? "",
    compareDocumentId: input.compareDocumentId ?? "",
    compareDocumentContent: input.compareDocumentContent ?? "",
    fileName: input.fileName ?? "",
    fileType: input.fileType ?? "",
  }, { configurable: { thread_id: threadId ?? crypto.randomUUID() } });
}
