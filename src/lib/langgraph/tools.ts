import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const extractFieldSchema = z.object({
  fieldName: z.string().describe("Name of the field to extract"),
  fieldValue: z.string().describe("Extracted value from the document"),
  confidence: z.number().min(0).max(100).describe("Confidence score 0-100"),
});

const generateSummarySchema = z.object({
  summary: z.string().describe("Document summary"),
  keyPoints: z.array(z.string()).describe("Key points from the document"),
});

const answerQuestionSchema = z.object({
  answer: z.string().describe("Answer to the question"),
  sources: z.array(z.string()).describe("Relevant excerpts from the document"),
});

export const extractFieldTool = new DynamicStructuredTool({
  name: "extract_field",
  description: "Extract a specific field/value from the document content",
  schema: extractFieldSchema,
  func: async (args) => JSON.stringify({ success: true, ...args }),
});

export const generateSummaryTool = new DynamicStructuredTool({
  name: "generate_summary",
  description: "Generate a summary of the document with key points",
  schema: generateSummarySchema,
  func: async (args) => JSON.stringify({ success: true, ...args }),
});

export const answerQuestionTool = new DynamicStructuredTool({
  name: "answer_question",
  description: "Answer a question based on document content",
  schema: answerQuestionSchema,
  func: async (args) => JSON.stringify({ success: true, ...args }),
});

export const extractTools = [extractFieldTool];
export const summaryTools = [generateSummaryTool];
export const qaTools = [answerQuestionTool];
export const allTools = [extractFieldTool, generateSummaryTool, answerQuestionTool];
