# API Security Hardening — Spec

**Data:** 2026-08-05
**Branch/worktree:** `claude/docmind-improvements-585ee9`

## Problema

Investigação confirmou (lendo o código atual, não só a memory) que as rotas de
API do docmind não fazem verificação real de sessão. O middleware
(`src/proxy.ts`) só intercepta `/admin/:path*` (páginas), nunca `/api/*`, e o
frontend do admin nunca envia `x-organization-id` manualmente — dependia do
proxy fazer isso, o que nunca acontece pra essas rotas.

Achados confirmados nesta investigação:

1. **Rotas de documentos sem auth real**: `POST/GET /api/documents`,
   `GET/DELETE /api/documents/[id]`, `GET /api/admin/documents`, `GET
   /api/admin/stats` confiam no header `x-organization-id` enviado pelo
   cliente (que nunca é enviado) ou não filtram por organização nenhuma.
   Resultado: qualquer request sem login lista/apaga documentos de qualquer
   organização; contagens do dashboard admin somam todas as organizações.
2. **Backdoor de criação de admin em `/api/admin/login`**: quando o email
   informado não existe, a rota cria um novo usuário admin *sempre*,
   anexado à primeira organização encontrada no banco — não só na primeira
   vez que o banco está vazio. Qualquer pessoa pode virar admin de uma
   organização existente só enviando um email nunca usado.
3. **Fail-open na verificação de senha**: `verifyPassword(...).catch(() =>
   true)` — se `bcryptjs.compare` lançar por qualquer motivo, o login é
   tratado como válido.
4. **`JWT_SECRET` com fallback silencioso** para `"dev-secret"` em
   `src/lib/auth.ts` e `src/proxy.ts` — se a env var não for setada em
   produção, todos os tokens usam um segredo público e previsível.
5. **Senha do admin demo logada em texto plano** em `src/db/seed.ts`.

## Fora de escopo nesta rodada

`.env.example` desatualizado, ausência de testes automatizados (sem
framework configurado), nó "Comparator" do LangGraph — ficam para rodadas
futuras (o usuário escolheu focar em segurança da API agora).

## Objetivo

Toda rota de API que lê ou modifica dados de documentos/organização deve
exigir uma sessão de admin válida (cookie `admin_session` verificado via JWT)
e escopar toda leitura/escrita ao `organizationId` da sessão — nunca a um
header controlado pelo cliente. O bootstrap de "primeiro admin" só deve
funcionar quando não existe nenhum usuário no banco.

## Critério de aceite

- `curl` sem cookie para POST/GET `/api/documents`, GET/DELETE
  `/api/documents/[id]`, GET `/api/admin/documents`, GET `/api/admin/stats`
  retorna 401.
- Duas organizações distintas (criadas via `/admin/signup`) nunca veem
  documentos uma da outra, nem por header forjado.
- `POST /api/admin/login` com email inexistente só cria um novo admin
  quando a tabela `docmind_users` está vazia; caso contrário retorna 401.
- `verifyPassword` que lança exceção nunca autentica (fail closed).
- Em produção (`NODE_ENV=production`) sem `JWT_SECRET` setado, o processo
  falha ao carregar em vez de usar um segredo padrão.
- `pnpm typecheck` e `pnpm lint` passam sem erros novos.
