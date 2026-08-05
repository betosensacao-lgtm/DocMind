# Round 3: Translate app to English — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: none required — this is a mechanical, low-risk text-only translation with no logic changes. Executed directly, verified with typecheck/lint/test plus a live visual pass.

**Goal:** Every user-facing string (UI copy, error messages, AI prompt templates) is in English, and the three LLM prompts that explicitly instructed the model to respond in Brazilian Portuguese no longer do.

**Architecture:** Pure string replacement across 9 files already identified by a full-codebase survey (see spec). No new files, no logic/behavior changes, no new dependencies.

---

### Task 1: Homepage — `src/app/page.tsx`

Replace all Portuguese strings with their English equivalents (see spec for the full list): nav links, hero heading/subheading/CTAs, feature card titles/descriptions, footer copyright line. No structural changes.

### Task 2: Admin sidebar — `src/app/admin/layout.tsx`

Translate `navItems` labels ("Dashboard RAG" → "RAG Dashboard", "Documentos" → "Documents", "Extrações" → "Extractions"), default user name ("Consultor RAG" → "RAG Consultant", both occurrences), "Vector Search Ativo" → "Vector Search Active", logout button `title="Sair"` → `title="Sign Out"`.

### Task 3: Extractions page — `src/app/admin/extractions/page.tsx`

Translate heading, subheading, empty-state message + CTA, table section title, table headers (Documento/Tipo/Status RAG/Ação → Document/Type/RAG Status/Action), status badge "VETORIZADO (1536D)" → "VECTORIZED (1536D)", link text "Ver Chat RAG" → "View RAG Chat".

### Task 4: Realtime toasts — `src/components/realtime-dashboard.tsx`

Translate the two `toast.info`/`toast.success` messages. (Confirmed live: imported and rendered by `src/app/layout.tsx`, not dead code.)

### Task 5: Document detail page — `src/app/documents/[id]/page.tsx`

Translate: initial assistant chat message, fallback reply/error strings, "Voltar para Documentos" → "Back to Documents", document-title fallback, "PRONTO" status fallback → "READY", "pág(s)" → "page(s)", "Conteúdo do Documento" → "Document Content", "Copiar Texto" → "Copy Text", empty-content fallback, "Assistente IA RAG DocMind" → "DocMind RAG AI Assistant", "Comparar com..." → "Compare with...", "Analisando documento..." → "Analyzing document...", input placeholder, "Enviar" → "Send".

### Task 6: LLM prompts — `src/lib/langgraph/nodes.ts`

Translate every prompt template and fallback string in `processorNode`, `extractorNode`, `summarizerNode`, `qaNode`, `comparatorNode`. Critically: remove/replace the "Responda sempre em português do Brasil" / "elabore ... em português do Brasil" / "responda em português do Brasil" instructions in `summarizerNode`, `qaNode`, and `comparatorNode` with plain English prompts (no explicit language instruction needed once the prompt itself is in English — the model will respond in English by default; keep a light "respond clearly and objectively" instruction where the original had one, just without the language mandate). `ROUTER_PROMPT` is already English — do not touch it.

### Task 7: Document upload route — `src/app/api/documents/route.ts`

Translate: "Nenhum arquivo fornecido" → "No file provided", the fallback document-content string, "Erro ao fazer upload do documento: " → "Error uploading document: ".

### Task 8: Chat route — `src/app/api/chat/route.ts`

Translate: injection-detected reply, fallback reply, and the 500 error message.

### Task 9: Login route — `src/app/api/admin/login/route.ts`

Translate error messages ("Email e senha obrigatórios", "Credenciais inválidas" ×2, "Usuário desativado", "Erro interno no servidor") and the two Portuguese code comments (project convention per `AGENTS.md` is English code/docs).

### Task 10: Verification

- [ ] `pnpm typecheck` clean
- [ ] `pnpm lint` clean (only the known pre-existing, out-of-scope error in `admin/login/page.tsx` allowed)
- [ ] `pnpm test` — all existing tests still pass (none of them assert on Portuguese strings, so no test file changes expected)
- [ ] Live browser pass: homepage, admin sidebar, extractions page, document detail page — visually confirm no Portuguese text remains
- [ ] Live chat test: ask the assistant a question about an uploaded document and confirm the reply is in English (not just the UI chrome)
- [ ] Live comparator test: compare two documents and confirm the reply is in English
- [ ] Clean up any temp env/launch files and test data created during verification
