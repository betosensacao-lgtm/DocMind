import { Annotation } from "@langchain/langgraph";
import { type BaseMessage } from "@langchain/core/messages";

export const DocState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: (a, b) => a.concat(b) }),
  documentId: Annotation<string>(),
  organizationId: Annotation<string>(),
  fileName: Annotation<string>(),
  fileType: Annotation<string>(),
  documentContent: Annotation<string>(),
  extractionResults: Annotation<Record<string, string>>({ reducer: (a, b) => ({ ...a, ...b }) }),
  summary: Annotation<string>(),
  conversationSummary: Annotation<string>(),
  error: Annotation<string | null>(),
  locale: Annotation<string>(),
});
