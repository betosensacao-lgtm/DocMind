const INJECTION_PATTERNS = [/ignore\s+(all\s+)?(previous|above|prior)/i, /forget\s+(all\s+)?(previous|above|prior)/i, /you\s+are\s+(now\s+)?/i, /act\s+as\s+/i, /system\s+prompt/i];
const LEAK_PATTERNS = [/(?:GROQ|OPENAI)_(?:API_KEY|ACCESS_TOKEN)/i, /sk-[a-zA-Z0-9]{20,}/];

export function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").slice(0, 5000);
}

export function detectInjection(input: string): boolean {
  for (const p of INJECTION_PATTERNS) { if (p.test(input)) return true; }
  return false;
}

export function detectLeak(output: string): boolean {
  for (const p of LEAK_PATTERNS) { if (p.test(output)) return true; }
  return false;
}
