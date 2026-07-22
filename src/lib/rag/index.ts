import ai, { CHAT_MODEL } from "@/lib/ai";

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const res = await ai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });
    return res.data[0].embedding;
  } catch {
    return [];
  }
}

export async function retrieveRelevantChunks(
  query: string,
  chunks: { id: string; content: string; embedding: number[] }[],
  topK = 3
): Promise<{ id: string; content: string; score: number }[]> {
  const queryEmbedding = await getEmbedding(query);
  if (queryEmbedding.length === 0) return chunks.slice(0, topK).map((c) => ({ id: c.id, content: c.content, score: 0 }));

  const scored = chunks
    .map((c) => ({ id: c.id, content: c.content, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export async function generateAnswer(
  query: string,
  context: string
): Promise<string> {
  try {
    const res = await ai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: "You are a document analysis assistant. Answer questions based only on the provided context. Be concise and cite specific information from the document." },
        { role: "user", content: `Context from document:\n${context}\n\nQuestion: ${query}` },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    });
    return res.choices[0]?.message?.content ?? "No answer generated.";
  } catch (err) {
    console.error("[RAG ERROR]", err);
    return "Error generating answer.";
  }
}
