# DocMind

Document intelligence platform with RAG and multi-agent processing.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Drizzle ORM (PostgreSQL via Supabase)
- LangGraph.js (multi-agent orchestration)
- Groq via OpenAI SDK
- pgvector for embeddings
- pdf-parse for PDF processing

## Commands
```bash
pnpm dev
pnpm build
npx tsc --noEmit
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Env
- `GROQ_API_KEY` required for AI
- `DATABASE_URL` and `DIRECT_URL` for Supabase
- `JWT_SECRET` for auth

## LangGraph
Multi-agent document processing in `src/lib/langgraph/`:
- Router, Processor, Extractor, QA, Summarizer, Comparator

## Language
Code and docs in English.
