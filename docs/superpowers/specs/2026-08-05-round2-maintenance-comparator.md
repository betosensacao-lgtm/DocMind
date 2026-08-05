# Round 2: env docs, lint tooling, security-code tests, Comparator node — Spec

**Data:** 2026-08-05
**Branch/worktree:** `claude/docmind-improvements-585ee9`

## Contexto

Continuação da rodada anterior ([2026-08-05-api-security-hardening.md](2026-08-05-api-security-hardening.md)), que deixou 4 itens fora de escopo. O usuário autorizou seguir com todos, na sequência, e definiu o escopo de dois deles que exigiam decisão:
- Testes automatizados: Vitest, focado no código de segurança do round anterior.
- Nó "Comparator": compara dois documentos já carregados (conteúdo/diferenças), não campos extraídos contra um valor esperado.

## Itens

### 1. `.env.example` desatualizado
Faltam variáveis que o código realmente usa (confirmado por grep em `src/`): `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `DOCMIND_GROQ_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 2. `next lint` quebrado
Causa raiz confirmada: Next.js 16 **removeu o comando `next lint`** (não existe mais `next-lint.js` em `node_modules/next/dist/cli/`) — por isso `pnpm lint` falha com "Invalid project directory provided, no such directory: ...\lint" (o CLI trata "lint" como argumento posicional de outro comando). O projeto usa ESLint 9 (flat config) e já tem `eslint-config-next@16` instalado, que **já exporta um array de flat config nativo** (confirmado rodando `require('eslint-config-next')` — sem precisar de `@eslint/eslintrc`/`FlatCompat`). Falta só o `eslint.config.mjs` na raiz e trocar o script `lint` no `package.json` de `"next lint"` para `"eslint ."`.

### 3. Testes automatizados (Vitest, focado em segurança)
Sem framework configurado hoje. Adicionar Vitest e cobrir exatamente o código endurecido no round anterior:
- `src/lib/jwt-secret.ts` — falha rápido em produção sem `JWT_SECRET`.
- `src/lib/api-auth.ts` — `getSessionFromRequest` (sem cookie → null; token inválido → null; token válido → sessão).
- `src/app/api/admin/login/route.ts` — o bootstrap só cria admin com `users` vazia (não com "este email não existe"); senha inválida ou erro na verificação sempre nega.

Fora de escopo: parser de documentos, chunking, rotas de upload/chat, cobertura ampla — o usuário escolheu explicitamente o escopo focado.

### 4. Nó "Comparator" do LangGraph
Hoje o grafo (`src/lib/langgraph/graph.ts`) só tem Router → {Processor, Extractor, Summarizer, QA}. `AGENTS.md` lista "Comparator" como nó existente mas nunca foi implementado — nenhuma spec funcional documentada em lugar nenhum. Definido agora: compara o documento atual com um **segundo documento já carregado na mesma organização**, escolhido pelo usuário na tela de detalhe do documento, e responde com semelhanças/diferenças de conteúdo.

**Restrição de segurança (não negociável, dado o que este round anterior corrigiu):** o segundo documento (`compareDocumentId`) passa pela **mesma verificação de sessão + posse por organização** que já existe para `documentId` em `/api/chat` — client nunca escolhe org, e um id de documento de outra organização nunca deve ser aceito. Não repetir o erro corrigido no round anterior.

## Critério de aceite
- `pnpm lint` roda e passa (ou reporta erros reais de lint, não o erro de CLI atual).
- `.env.example` reflete todas as env vars que o código usa.
- `pnpm test` roda os 3 arquivos de teste de segurança, todos passando.
- Na tela de detalhe de um documento, dá pra escolher um segundo documento da mesma organização e pedir uma comparação; a resposta reflete conteúdo real dos dois documentos.
- Uma tentativa de comparar com um `compareDocumentId` de outra organização (ou sem sessão) é rejeitada do mesmo jeito que já acontece hoje para `documentId`.
- `pnpm typecheck` limpo em cada commit.
