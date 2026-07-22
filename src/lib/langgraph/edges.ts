import type { DocState } from "./state";

export function routeAfterRouter(state: typeof DocState.State): string {
  const err = state.error;
  if (err === "PROCESS") return "processor";
  if (err === "EXTRACT") return "extractor";
  if (err === "SUMMARIZE") return "summarizer";
  if (err === "QUESTION") return "qa";
  return "__end__";
}

export function routeAfterProcessor(state: typeof DocState.State): string {
  if (state.documentContent) return "extractor";
  return "__end__";
}

export function routeAfterExtractor(_state: typeof DocState.State): string {
  return "__end__";
}

export function routeAfterSummarizer(_state: typeof DocState.State): string {
  return "__end__";
}

export function routeAfterQa(_state: typeof DocState.State): string {
  return "__end__";
}
