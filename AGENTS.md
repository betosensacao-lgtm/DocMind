# DocMind

Document intelligence platform with RAG and multi-agent processing.

## Stack
- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Drizzle ORM (PostgreSQL via Supabase) — schema `docmind`
- LangGraph.js (multi-agent orchestration)
- OpenRouter via OpenAI SDK
- pgvector for embeddings
- pdf-parse for PDF processing

## Commands
```bash
pnpm dev              # Next.js dev server
pnpm build            # Production build
npx tsc --noEmit      # Typecheck (alias: pnpm typecheck)
pnpm db:generate      # Generate Drizzle migration
pnpm db:migrate       # Apply migrations
pnpm db:push          # Push schema directly to DB
pnpm db:seed          # Seed DB (creates Demo Corp org + admin user)
```

## Env
- `OPENROUTER_API_KEY` required for AI
- `DATABASE_URL` (pooler) and `DIRECT_URL` (direct, for migrations)
- `JWT_SECRET` for auth
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Supabase client
- `N8N_WEBHOOK_SECRET` for n8n integration

## LangGraph
Multi-agent document processing in `src/lib/langgraph/`:
- Router, Processor, Extractor, QA, Summarizer, Comparator
- PostgresSaver checkpointer (pg, not MemorySaver)
- pgvector similarity search in QA node

## Persistence
- Checkpointer: `PostgresSaver` via `@langchain/langgraph-checkpoint-postgres`
- Embeds document chunks with mock vectors for RAG (OpenRouter has no embedding model)

## Drizzle
- All tables in `docmind` PostgreSQL schema (isolated from other projects)
- `customType` for `vector(1536)` column on `document_chunks.embedding`

## Language
Code and docs in English.