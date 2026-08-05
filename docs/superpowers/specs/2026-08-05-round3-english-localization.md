# Round 3: Translate app to English — Spec

**Data:** 2026-08-05
**Branch/worktree:** `claude/docmind-improvements-585ee9`

## Contexto

O usuário pediu que o app inteiro esteja em inglês, já que faz parte do portfólio dele. Levantamento completo (agente Explore, cobrindo todos os `.ts`/`.tsx` sob `src/`) encontrou português em 8 arquivos: 4 páginas/componentes de UI, 3 arquivos de rota de API (mensagens de erro + comentários), e os prompts de IA em `src/lib/langgraph/nodes.ts`.

**Achado mais importante:** três prompts (`summarizerNode`, `qaNode`, `comparatorNode`) instruem explicitamente o modelo a responder em português do Brasil ("Responda sempre em português do Brasil", etc.) — mesmo traduzindo toda a UI visível, o app continuaria respondendo em português nas conversas de chat até essas instruções serem trocadas para inglês.

## Escopo

Traduzir para inglês, sem mudar nenhuma lógica/comportamento:
1. `src/app/page.tsx` — homepage/marketing copy
2. `src/app/admin/layout.tsx` — nav labels, nome padrão de usuário, tooltip de logout
3. `src/app/admin/extractions/page.tsx` — títulos, cabeçalhos de tabela, mensagens de estado vazio
4. `src/components/realtime-dashboard.tsx` — toasts de realtime (usado em `layout.tsx`, não é código morto)
5. `src/app/documents/[id]/page.tsx` — mensagens de chat, labels, placeholders
6. `src/lib/langgraph/nodes.ts` — todos os templates de prompt + remoção das 3 instruções "responda em português"
7. `src/app/api/documents/route.ts` — mensagens de erro + texto de fallback do conteúdo
8. `src/app/api/chat/route.ts` — mensagens de erro/fallback
9. `src/app/api/admin/login/route.ts` — mensagens de erro + comentários de código (já é convenção do projeto ter código/comentários em inglês, per `AGENTS.md`)

**Fora de escopo:** nenhuma outra mudança de comportamento, nenhum arquivo além dos listados (o levantamento confirmou que todo o resto já está em inglês ou é `.env`/schema/config sem texto visível).

## Critério de aceite
- Nenhuma string em português visível na UI (visualmente, navegando pelas telas principais).
- Uma pergunta ao assistente de chat (`qaNode`) produz resposta em inglês.
- Uma comparação de documentos (`comparatorNode`) produz resposta em inglês.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` limpos.
