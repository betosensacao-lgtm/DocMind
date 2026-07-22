import OpenAI from "openai";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

function getAI(): OpenAI {
  const key = OPENROUTER_KEY ?? process.env.GEMINI_API_KEY ?? process.env.DOCMIND_GROQ_API_KEY ?? process.env.GROQ_API_KEY;
  if (!key) throw new Error("No API key configured");

  return new OpenAI({
    baseURL: OPENROUTER_KEY
      ? "https://openrouter.ai/api/v1"
      : process.env.GEMINI_API_KEY
        ? "https://generativelanguage.googleapis.com/v1beta/openai/"
        : "https://api.groq.com/openai/v1",
    apiKey: key,
  });
}

const ai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getAI() as any)[prop];
  },
});

export const CHAT_MODEL = OPENROUTER_KEY
  ? "openrouter/free"
  : process.env.GEMINI_API_KEY
    ? "gemini-flash-latest"
    : process.env.GROQ_CHAT_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";

export const AI_BASE_URL = OPENROUTER_KEY
  ? "https://openrouter.ai/api/v1"
  : process.env.GEMINI_API_KEY
    ? "https://generativelanguage.googleapis.com/v1beta/openai/"
    : "https://api.groq.com/openai/v1";

export const AI_API_KEY = OPENROUTER_KEY ?? process.env.GEMINI_API_KEY ?? process.env.DOCMIND_GROQ_API_KEY ?? process.env.GROQ_API_KEY;

export function toChatMessages(messages: { role: string; content: string }[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));
}

export default ai;
