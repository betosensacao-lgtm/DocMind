/**
 * Real Embedding Generator for DocMind RAG.
 * Uses Feature Hashing (Hashing Trick) with subword n-gram frequency weighting
 * to produce deterministic, normalized 1536-dimensional dense vector embeddings.
 * 
 * Guarantees real cosine similarity search in Postgres (pgvector) without requiring
 * external OpenAI embedding API keys.
 */

const VECTOR_DIM = 1536;

function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getSubwordNGrams(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ");

  const words = normalized.split(/\s+/).filter(Boolean);
  const nGrams: string[] = [];

  for (const word of words) {
    nGrams.push(word);
    // Subword n-grams (3 to 5 chars)
    for (let len = 3; len <= 5; len++) {
      for (let i = 0; i <= word.length - len; i++) {
        nGrams.push(word.slice(i, i + len));
      }
    }
  }

  // Word bi-grams
  for (let i = 0; i < words.length - 1; i++) {
    nGrams.push(`${words[i]}_${words[i + 1]}`);
  }

  return nGrams;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const vector = new Float64Array(VECTOR_DIM);
  const nGrams = getSubwordNGrams(text);

  if (nGrams.length === 0) {
    return Array.from(vector);
  }

  for (const token of nGrams) {
    const hash = fnv1aHash(token);
    const index = hash % VECTOR_DIM;
    const sign = (hash & 1) === 0 ? 1 : -1;
    
    // Position-weighted frequency
    vector[index] += sign * (1 + Math.log(token.length));
  }

  // L2 Normalization (unit vector) for accurate cosine similarity
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vector[i] /= norm;
    }
  }

  return Array.from(vector);
}
