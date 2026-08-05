# Round 2: env docs, lint tooling, security tests, Comparator node — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 4 items deferred from the API-security-hardening round: fix `.env.example`, fix the broken `next lint` command, add focused Vitest coverage for the security code from round 1, and implement the previously-unbuilt LangGraph "Comparator" node (compares two documents the user selects) — applying the same session+org-ownership pattern already used everywhere else, so this doesn't reopen the cross-tenant leak class of bug fixed last round.

**Architecture:** `.env.example` and the lint fix are small, independent, mechanical changes. Vitest is added as a new devDependency with a minimal config (`vitest.config.ts` + `vite-tsconfig-paths` for the `@/` import alias) and three test files targeting exactly the round-1 security code (`jwt-secret.ts`, `api-auth.ts`, the login route's bootstrap gate). The Comparator node follows the existing LangGraph node pattern (`src/lib/langgraph/nodes.ts`) — new `compareDocumentId`/`compareDocumentContent` state fields, a `COMPARE` router intent, a `comparatorNode`, and edge/graph wiring — with the API layer (`/api/chat`) requiring a verified session and organization ownership for the compare document, exactly like it already does for the primary document. A small dropdown on the document detail page lets the user pick a second document from the same organization.

**Tech Stack:** Next.js 16 App Router, Drizzle/Postgres, LangGraph.js, Vitest (new), ESLint 9 flat config (new config file, no new lint deps needed — `eslint-config-next@16` already ships a native flat-config array).

---

## File Structure

- Modify: `.env.example` — add missing env vars.
- Create: `eslint.config.mjs` — flat config using `eslint-config-next`'s exported array.
- Modify: `package.json` — `"lint"` script → `"eslint ."`; add `"test": "vitest run"`; add devDependencies `vitest`, `vite-tsconfig-paths`.
- Create: `vitest.config.ts`.
- Create: `src/lib/__tests__/jwt-secret.test.ts`.
- Create: `src/lib/__tests__/api-auth.test.ts`.
- Create: `src/app/api/admin/login/__tests__/route.test.ts`.
- Modify: `src/lib/langgraph/state.ts` — add `compareDocumentId`, `compareDocumentContent`.
- Modify: `src/lib/langgraph/nodes.ts` — add `comparatorNode`, add `COMPARE` to the router intent list.
- Modify: `src/lib/langgraph/edges.ts` — add `routeAfterComparator`, route `COMPARE` intent.
- Modify: `src/lib/langgraph/graph.ts` — wire `comparatorNode` into the graph, thread new fields through `runDocGraph`.
- Modify: `src/lib/langgraph/index.ts` — export the new node/edge.
- Modify: `src/app/api/chat/route.ts` — accept `compareDocumentId`/`compareDocumentContent`, same auth+ownership check as the primary document.
- Modify: `src/app/documents/[id]/page.tsx` — "Comparar com" dropdown, fetch the chosen document's content, send it along with chat messages.

---

### Task 1: Update `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Replace the file**

```
# Database (Supabase)
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# LLM (OpenRouter primary; Gemini/Groq as fallbacks — see src/lib/ai.ts)
OPENROUTER_API_KEY=
GEMINI_API_KEY=
DOCMIND_GROQ_API_KEY=
GROQ_API_KEY=

# Google OAuth (Drive import)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# JWT
JWT_SECRET=

# Storage (local)
UPLOAD_DIR=data/uploads
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(docmind): update .env.example with all env vars the code actually uses"
```

---

### Task 2: Fix `next lint`

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json`

**Context:** Next.js 16 removed the `next lint` CLI command entirely (confirmed: `node_modules/next/dist/cli/next-lint.js` does not exist in this install). That's why `pnpm lint` fails with `Invalid project directory provided, no such directory: ...\lint` — Next's CLI has no `lint` subcommand anymore and misparses `lint` as a positional argument. `eslint-config-next@16` (already a devDependency) ships a native ESLint 9 flat-config array as its default export — confirmed by running `node -e "console.log(require('eslint-config-next'))"`, no `@eslint/eslintrc`/`FlatCompat` needed.

- [ ] **Step 1: Create `eslint.config.mjs`**

```js
import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**"],
  },
];
```

- [ ] **Step 2: Update the lint script**

In `package.json`, change:

```json
"lint": "next lint",
```

to:

```json
"lint": "eslint .",
```

- [ ] **Step 3: Run it**

Run: `pnpm lint`
Expected: ESLint runs and reports real lint findings (or none) — NOT the "Invalid project directory" error. If it reports findings, do not fix unrelated pre-existing code in this task — only fix findings if they're trivial one-liners in files this plan already touches; otherwise leave them and report what was found in your final report.

- [ ] **Step 4: Commit**

```bash
git add eslint.config.mjs package.json
git commit -m "fix(docmind): replace removed next-lint CLI with direct ESLint flat config"
```

---

### Task 3: Add Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add -D vitest vite-tsconfig-paths
```

- [ ] **Step 2: Add the test script**

In `package.json`, add alongside the other scripts:

```json
"test": "vitest run",
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Verify the runner works with zero tests**

Run: `pnpm test`
Expected: Vitest starts and reports "No test files found" (or passes if Task 4/5/6 already landed) — not a config/resolution error.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore(docmind): add Vitest test runner"
```

---

### Task 4: Test `src/lib/jwt-secret.ts`

**Files:**
- Create: `src/lib/__tests__/jwt-secret.test.ts`

**Context:** `src/lib/jwt-secret.ts` throws at module-load time if `JWT_SECRET` is unset and `NODE_ENV === "production"`. Testing a module-level throw requires a fresh module instance per test (`vi.resetModules()` + dynamic `import()`), since a normal top-level `import` is cached after the first load.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("jwt-secret", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when JWT_SECRET is unset in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;

    await expect(import("../jwt-secret")).rejects.toThrow(
      "JWT_SECRET environment variable must be set in production"
    );
  });

  it("does not throw when JWT_SECRET is set in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-real-secret";

    const { JWT_SECRET } = await import("../jwt-secret");
    expect(JWT_SECRET).toBeInstanceOf(Uint8Array);
  });

  it("falls back to a dev secret outside production when unset", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.JWT_SECRET;

    const { JWT_SECRET } = await import("../jwt-secret");
    expect(JWT_SECRET).toBeInstanceOf(Uint8Array);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test src/lib/__tests__/jwt-secret.test.ts`
Expected: 3 tests pass. If `NODE_ENV` is read-only in this environment's `process.env`, adjust to `vi.stubEnv("NODE_ENV", "production")` / `vi.unstubAllEnvs()` instead of direct assignment — use whichever actually works, the assertions (not the env-manipulation mechanism) are what matters.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/jwt-secret.test.ts
git commit -m "test(docmind): cover jwt-secret fail-fast behavior"
```

---

### Task 5: Test `src/lib/api-auth.ts`

**Files:**
- Create: `src/lib/__tests__/api-auth.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSessionFromRequest } from "../api-auth";
import { verifySessionToken } from "../auth";

vi.mock("../auth", () => ({
  COOKIE_NAME: "admin_session",
  verifySessionToken: vi.fn(),
}));

describe("getSessionFromRequest", () => {
  beforeEach(() => {
    vi.mocked(verifySessionToken).mockReset();
  });

  it("returns null when there is no cookie header", async () => {
    const request = new Request("http://localhost/api/documents");
    await expect(getSessionFromRequest(request)).resolves.toBeNull();
  });

  it("returns null when the admin_session cookie is missing among other cookies", async () => {
    const request = new Request("http://localhost/api/documents", {
      headers: { cookie: "other=value" },
    });
    await expect(getSessionFromRequest(request)).resolves.toBeNull();
  });

  it("returns null when verifySessionToken rejects", async () => {
    vi.mocked(verifySessionToken).mockRejectedValue(new Error("bad token"));
    const request = new Request("http://localhost/api/documents", {
      headers: { cookie: "admin_session=bad-token" },
    });
    await expect(getSessionFromRequest(request)).resolves.toBeNull();
  });

  it("returns the session when the cookie verifies", async () => {
    const session = { userId: "u1", organizationId: "o1", email: "a@b.com", role: "admin" };
    vi.mocked(verifySessionToken).mockResolvedValue(session);
    const request = new Request("http://localhost/api/documents", {
      headers: { cookie: "admin_session=good-token" },
    });
    await expect(getSessionFromRequest(request)).resolves.toEqual(session);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test src/lib/__tests__/api-auth.test.ts`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/api-auth.test.ts
git commit -m "test(docmind): cover getSessionFromRequest cookie/session handling"
```

---

### Task 6: Test the `/api/admin/login` bootstrap gate and fail-closed password check

**Files:**
- Create: `src/app/api/admin/login/__tests__/route.test.ts`

**Context:** This is the highest-value test in this round — it directly guards the account-takeover backdoor closed in round 1 (auto-create must only fire when the `users` table is genuinely empty) and the fail-closed password check. Mock `@/db` (Drizzle's chainable query builder) and `@/lib/auth` so the route runs with no real database.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const dbMocks = vi.hoisted(() => {
  const selectResults: any[] = [];
  const insertResults: any[] = [];

  function makeBuilder(resultPromise: Promise<any>) {
    const builder: any = {};
    builder.from = vi.fn(() => builder);
    builder.where = vi.fn(() => builder);
    builder.limit = vi.fn(() => builder);
    builder.values = vi.fn(() => builder);
    builder.returning = vi.fn(() => resultPromise);
    builder.then = (resolve: any, reject: any) => resultPromise.then(resolve, reject);
    return builder;
  }

  return {
    selectResults,
    insertResults,
    select: vi.fn(() => makeBuilder(Promise.resolve(selectResults.shift() ?? []))),
    insert: vi.fn(() => makeBuilder(Promise.resolve(insertResults.shift() ?? []))),
  };
});

vi.mock("@/db", () => ({ db: { select: dbMocks.select, insert: dbMocks.insert } }));

const authMocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  verifyPassword: vi.fn(),
  createSessionToken: vi.fn(async () => "signed-token"),
  updateLastLogin: vi.fn(async () => undefined),
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
}));

vi.mock("@/lib/auth", () => authMocks);

const { POST } = await import("../route");

function jsonRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/admin/login", () => {
  beforeEach(() => {
    dbMocks.selectResults.length = 0;
    dbMocks.insertResults.length = 0;
    dbMocks.select.mockClear();
    dbMocks.insert.mockClear();
    authMocks.getUserByEmail.mockReset();
    authMocks.verifyPassword.mockReset();
  });

  it("does NOT auto-create an admin for an unknown email when users already exist", async () => {
    authMocks.getUserByEmail.mockResolvedValue(null);
    dbMocks.selectResults.push([{ count: 3 }]); // users count > 0 -> not a bootstrap

    const res = await POST(jsonRequest({ email: "attacker@example.com", password: "whatever" }));

    expect(res.status).toBe(401);
    expect(dbMocks.insert).not.toHaveBeenCalled();
  });

  it("auto-creates the first admin when the users table is genuinely empty", async () => {
    authMocks.getUserByEmail.mockResolvedValue(null);
    dbMocks.selectResults.push([{ count: 0 }]); // users count === 0 -> bootstrap
    dbMocks.selectResults.push([{ id: "org-1" }]); // existing org found
    dbMocks.insertResults.push([{
      id: "user-1", organizationId: "org-1", email: "first@example.com",
      name: "first", role: "admin", passwordHash: "hashed:secret123", active: true,
    }]);

    const res = await POST(jsonRequest({ email: "first@example.com", password: "secret123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.email).toBe("first@example.com");
    expect(dbMocks.insert).toHaveBeenCalledTimes(1); // only the user insert; org already existed
  });

  it("rejects a wrong password", async () => {
    authMocks.getUserByEmail.mockResolvedValue({
      id: "u1", organizationId: "o1", email: "real@example.com",
      name: "Real", role: "admin", passwordHash: "hash", active: true,
    });
    authMocks.verifyPassword.mockResolvedValue(false);

    const res = await POST(jsonRequest({ email: "real@example.com", password: "wrong" }));

    expect(res.status).toBe(401);
  });

  it("fails closed when password verification throws", async () => {
    authMocks.getUserByEmail.mockResolvedValue({
      id: "u1", organizationId: "o1", email: "real@example.com",
      name: "Real", role: "admin", passwordHash: "hash", active: true,
    });
    authMocks.verifyPassword.mockRejectedValue(new Error("bcrypt exploded"));

    const res = await POST(jsonRequest({ email: "real@example.com", password: "whatever" }));

    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it and fix mock mismatches**

Run: `pnpm test src/app/api/admin/login/__tests__/route.test.ts`

The mock chain methods (`from`/`where`/`limit`/`values`/`returning`/`then`) must match what `src/app/api/admin/login/route.ts` actually calls on `db.select(...)` / `db.insert(...)`. If a test fails because a chain method the route calls isn't on the mock builder, add it (returning `builder` for chaining, like the others). Do not change the route's behavior to make tests pass — only adjust the mock. All 4 tests must pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/login/__tests__/route.test.ts
git commit -m "test(docmind): cover admin-login bootstrap gate and fail-closed password check"
```

---

### Task 7: Add compare fields to LangGraph state

**Files:**
- Modify: `src/lib/langgraph/state.ts`

- [ ] **Step 1: Replace the file**

```ts
import { Annotation } from "@langchain/langgraph";
import { type BaseMessage } from "@langchain/core/messages";

export const DocState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: (a, b) => a.concat(b) }),
  documentId: Annotation<string>(),
  organizationId: Annotation<string>(),
  fileName: Annotation<string>(),
  fileType: Annotation<string>(),
  documentContent: Annotation<string>(),
  compareDocumentId: Annotation<string>(),
  compareDocumentContent: Annotation<string>(),
  extractionResults: Annotation<Record<string, string>>({ reducer: (a, b) => ({ ...a, ...b }) }),
  summary: Annotation<string>(),
  conversationSummary: Annotation<string>(),
  error: Annotation<string | null>(),
  locale: Annotation<string>(),
});
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: errors in `nodes.ts`/`graph.ts` referencing the new fields not existing yet are fine at this point — Tasks 8-9 add them. If `pnpm typecheck` errors on THIS file alone, fix before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/lib/langgraph/state.ts
git commit -m "feat(docmind): add compareDocumentId/compareDocumentContent to LangGraph state"
```

---

### Task 8: Add `comparatorNode` and the `COMPARE` router intent

**Files:**
- Modify: `src/lib/langgraph/nodes.ts`

- [ ] **Step 1: Update `ROUTER_PROMPT` and the valid-intent list**

Replace:

```ts
const ROUTER_PROMPT = `You are a document query classifier. Classify the user's request into ONE intent:
- PROCESS: User uploaded or mentioned a document to process
- EXTRACT: User wants to extract specific data, tables or fields
- SUMMARIZE: User wants a document summary, overview or main points
- QUESTION: User has a question about the document content
- UNKNOWN: Cannot determine intent
Respond ONLY with the single intent word.`;
```

with:

```ts
const ROUTER_PROMPT = `You are a document query classifier. Classify the user's request into ONE intent:
- PROCESS: User uploaded or mentioned a document to process
- EXTRACT: User wants to extract specific data, tables or fields
- SUMMARIZE: User wants a document summary, overview or main points
- COMPARE: User wants to compare the current document against another document
- QUESTION: User has a question about the document content
- UNKNOWN: Cannot determine intent
Respond ONLY with the single intent word.`;
```

In `routerNode`, replace:

```ts
    const valid = ["PROCESS", "EXTRACT", "SUMMARIZE", "QUESTION"];
```

with:

```ts
    const valid = ["PROCESS", "EXTRACT", "SUMMARIZE", "COMPARE", "QUESTION"];
```

- [ ] **Step 2: Add `comparatorNode`**

Add this function after `qaNode` (end of the file):

```ts
export async function comparatorNode(state: typeof DocState.State) {
  const llm = createLLM(0.2, 2048);

  if (!state.compareDocumentContent) {
    return {
      messages: [new AIMessage("Selecione um segundo documento para comparar antes de pedir a comparação.")],
    };
  }

  const contentA = state.documentContent ? state.documentContent.slice(0, 6000) : "Sem conteúdo disponível.";
  const contentB = state.compareDocumentContent.slice(0, 6000);

  const prompt = `Você é um especialista em análise comparativa de documentos.
Compare os dois documentos abaixo e responda em português do Brasil, de forma clara e objetiva, estruturando assim:

🔍 **COMPARAÇÃO DE DOCUMENTOS**

1. **Principais Semelhanças**
2. **Principais Diferenças**
3. **Pontos de Atenção** (valores, datas ou cláusulas divergentes, se houver)

Documento A:
${contentA}

Documento B:
${contentB}`;

  try {
    const r = await llm.invoke([new SystemMessage(prompt)]);
    return { messages: [new AIMessage(r.content.toString())] };
  } catch {
    return { messages: [new AIMessage("Desculpe, ocorreu um erro ao comparar os documentos. Por favor, tente novamente.")] };
  }
}
```

No new imports are needed — `createLLM`, `SystemMessage`, and `AIMessage` are already imported at the top of `nodes.ts`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors in `nodes.ts` (errors elsewhere referencing `comparatorNode`/`routeAfterComparator` not existing yet are expected until Task 9).

- [ ] **Step 4: Commit**

```bash
git add src/lib/langgraph/nodes.ts
git commit -m "feat(docmind): add comparatorNode and COMPARE router intent"
```

---

### Task 9: Wire the Comparator node into edges, graph, and exports

**Files:**
- Modify: `src/lib/langgraph/edges.ts`
- Modify: `src/lib/langgraph/graph.ts`
- Modify: `src/lib/langgraph/index.ts`

- [ ] **Step 1: Update `edges.ts`**

Replace `routeAfterRouter`:

```ts
export function routeAfterRouter(state: typeof DocState.State): string {
  const err = state.error;
  if (err === "PROCESS") return "processor";
  if (err === "EXTRACT") return "extractor";
  if (err === "SUMMARIZE") return "summarizer";
  if (err === "COMPARE") return state.compareDocumentContent ? "comparator" : "qa";
  if (err === "QUESTION") return "qa";
  // Default to QA node instead of ending silently
  return "qa";
}
```

Add at the end of the file:

```ts
export function routeAfterComparator(_state: typeof DocState.State): string {
  return "__end__";
}
```

- [ ] **Step 2: Replace `graph.ts`**

```ts
import { StateGraph } from "@langchain/langgraph";
import { DocState } from "./state";
import { routerNode, processorNode, extractorNode, summarizerNode, qaNode, comparatorNode } from "./nodes";
import { routeAfterRouter, routeAfterProcessor, routeAfterExtractor, routeAfterSummarizer, routeAfterQa, routeAfterComparator } from "./edges";
import { getCheckpointer, ensureCheckpointerSetup } from "./persistence";

const wf = new StateGraph(DocState)
  .addNode("router", routerNode)
  .addNode("processor", processorNode)
  .addNode("extractor", extractorNode)
  .addNode("summarizer", summarizerNode)
  .addNode("qa", qaNode)
  .addNode("comparator", comparatorNode)
  .addEdge("__start__", "router")
  .addConditionalEdges("router", routeAfterRouter)
  .addConditionalEdges("processor", routeAfterProcessor)
  .addConditionalEdges("extractor", routeAfterExtractor)
  .addConditionalEdges("summarizer", routeAfterSummarizer)
  .addConditionalEdges("qa", routeAfterQa)
  .addConditionalEdges("comparator", routeAfterComparator);

export const docGraph = wf.compile({ checkpointer: getCheckpointer() });

export async function runDocGraph(input: {
  messages: any[];
  organizationId: string;
  documentId?: string;
  documentContent?: string;
  compareDocumentId?: string;
  compareDocumentContent?: string;
  fileName?: string;
  fileType?: string;
}, threadId?: string) {
  await ensureCheckpointerSetup();
  return docGraph.invoke({
    messages: input.messages,
    organizationId: input.organizationId,
    documentId: input.documentId ?? "",
    documentContent: input.documentContent ?? "",
    compareDocumentId: input.compareDocumentId ?? "",
    compareDocumentContent: input.compareDocumentContent ?? "",
    fileName: input.fileName ?? "",
    fileType: input.fileType ?? "",
  }, { configurable: { thread_id: threadId ?? crypto.randomUUID() } });
}
```

- [ ] **Step 3: Replace `index.ts`**

```ts
export { DocState } from "./state";
export { routerNode, processorNode, extractorNode, summarizerNode, qaNode, comparatorNode } from "./nodes";
export { routeAfterRouter, routeAfterProcessor, routeAfterExtractor, routeAfterSummarizer, routeAfterQa, routeAfterComparator } from "./edges";
export { docGraph, runDocGraph } from "./graph";
export { getCheckpointer } from "./persistence";
export { allTools, extractTools, summaryTools, qaTools } from "./tools";
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors anywhere in `src/lib/langgraph/`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/langgraph/edges.ts src/lib/langgraph/graph.ts src/lib/langgraph/index.ts
git commit -m "feat(docmind): wire comparatorNode into the LangGraph graph"
```

---

### Task 10: Thread `compareDocumentId` through `/api/chat` with the same auth+ownership check as `documentId`

**Files:**
- Modify: `src/app/api/chat/route.ts`

**Context:** Round 1 fixed `/api/chat` so `documentId`/`documentContent` only reach the graph after a verified session confirms the document belongs to that session's organization (otherwise `qaNode`'s vector search and `processorNode`'s chunk insert were reachable by anyone who could guess a `documentId`). `compareDocumentId` is a second, independent document reference the client can send — it must go through the exact same check, or this reopens the same class of bug for the new field.

- [ ] **Step 1: Replace the file**

```ts
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { HumanMessage } from "@langchain/core/messages";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { runDocGraph } from "@/lib/langgraph";
import { sanitizeInput, detectInjection } from "@/lib/security/guardrails";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, documentId, documentContent, compareDocumentId, compareDocumentContent, conversationId } = body;

    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    let orgId = "demo";
    let safeDocumentId = "";
    let safeDocumentContent = "";
    let safeCompareDocumentId = "";
    let safeCompareDocumentContent = "";

    // documentId/compareDocumentId only flow through with a verified session that
    // owns each document — otherwise qaNode's vector lookup, processorNode's chunk
    // insert, and now comparatorNode would let an unauthenticated caller read or
    // poison any organization's document just by guessing its id.
    if (documentId || compareDocumentId) {
      const session = await getSessionFromRequest(request);
      if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      orgId = session.organizationId;

      if (documentId) {
        const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
        if (!doc || doc.organizationId !== session.organizationId) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        safeDocumentId = documentId;
        safeDocumentContent = documentContent ?? "";
      }

      if (compareDocumentId) {
        const [compareDoc] = await db.select().from(documents).where(eq(documents.id, compareDocumentId));
        if (!compareDoc || compareDoc.organizationId !== session.organizationId) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        safeCompareDocumentId = compareDocumentId;
        safeCompareDocumentContent = compareDocumentContent ?? "";
      }
    }

    const sanitized = sanitizeInput(message);
    if (detectInjection(sanitized)) {
      return NextResponse.json({ reply: "Desculpe, não posso processar essa mensagem." });
    }

    const result = await runDocGraph({
      messages: [new HumanMessage(sanitized)],
      organizationId: orgId,
      documentId: safeDocumentId,
      documentContent: safeDocumentContent,
      compareDocumentId: safeCompareDocumentId,
      compareDocumentContent: safeCompareDocumentContent,
    }, conversationId);

    const messages = result.messages || [];
    const lastMsg = messages[messages.length - 1];

    let reply = "";
    if (typeof lastMsg?.content === "string" && lastMsg.content.trim() && !lastMsg.content.startsWith("[Intent:")) {
      reply = lastMsg.content;
    } else if (result.summary) {
      reply = result.summary;
    } else {
      // Find any message with string content
      for (let i = messages.length - 1; i >= 0; i--) {
        const text = messages[i]?.content;
        if (typeof text === "string" && text.trim() && !text.startsWith("[Intent:")) {
          reply = text;
          break;
        }
      }
    }

    if (!reply) {
      reply = result.summary || "Documento analisado com sucesso.";
    }

    return NextResponse.json({
      reply,
      summary: result.summary,
      extractions: result.extractionResults,
      conversationId: conversationId ?? crypto.randomUUID(),
    });
  } catch (error) {
    console.error("[CHAT ERROR]", error);
    return NextResponse.json({ error: "Erro interno no servidor ao consultar o documento" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat(docmind): require session + org ownership for compareDocumentId in /api/chat"
```

---

### Task 11: "Comparar com" picker on the document detail page

**Files:**
- Modify: `src/app/documents/[id]/page.tsx`

- [ ] **Step 1: Add the compare-document state and fetch**

After the existing state declarations (`const [sending, setSending] = useState(false);`), add:

```ts
  const [compareOptions, setCompareOptions] = useState<{ id: string; fileName: string }[]>([]);
  const [compareId, setCompareId] = useState("");
  const [compareContent, setCompareContent] = useState("");

  useEffect(() => {
    fetch("/api/admin/documents")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { id: string; fileName: string }[]) => {
        if (Array.isArray(data)) setCompareOptions(data.filter((d) => d.id !== id));
      })
      .catch(() => {});
  }, [id]);

  async function handleCompareSelect(selectedId: string) {
    setCompareId(selectedId);
    if (!selectedId) {
      setCompareContent("");
      return;
    }
    try {
      const res = await fetch(`/api/documents/${selectedId}`);
      if (!res.ok) { setCompareContent(""); return; }
      const data = await res.json();
      setCompareContent(data.textContent || "");
    } catch {
      setCompareContent("");
    }
  }
```

- [ ] **Step 2: Send the compare fields with the chat message**

In `handleSend`, replace:

```ts
        body: JSON.stringify({
          documentId: id,
          documentContent: doc?.textContent || "",
          message: userMsg,
        }),
```

with:

```ts
        body: JSON.stringify({
          documentId: id,
          documentContent: doc?.textContent || "",
          compareDocumentId: compareId || undefined,
          compareDocumentContent: compareId ? compareContent : undefined,
          message: userMsg,
        }),
```

- [ ] **Step 3: Add the picker to the chat panel header**

Replace:

```tsx
          <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-slate-200">Assistente IA RAG DocMind</h2>
          </div>
```

with:

```tsx
          <div className="p-4 border-b border-slate-800 bg-slate-900/30 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-slate-200">Assistente IA RAG DocMind</h2>
            </div>
            {compareOptions.length > 0 && (
              <select
                value={compareId}
                onChange={(e) => handleCompareSelect(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="">Comparar com...</option>
                {compareOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.fileName}</option>
                ))}
              </select>
            )}
          </div>
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "src/app/documents/[id]/page.tsx"
git commit -m "feat(docmind): add document comparison picker to the document detail page"
```

---

### Task 12: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck, lint, and test the whole project**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all three pass clean.

- [ ] **Step 2: Live comparator test**

Using the dev server and browser (copy `.env.local` into the worktree temporarily, same as round 1 — remember to delete it and `.claude/launch.json` afterward):
1. Sign up a throwaway test org via `/admin/signup`.
2. Upload two small, clearly-different `.txt` documents (e.g. one mentioning "Contrato A, valor R$ 1.000", the other "Contrato B, valor R$ 2.000").
3. Open the first document's detail page, select the second in the "Comparar com" dropdown, and send a message like "compare os dois documentos".
4. Confirm the reply references content from both documents (e.g. mentions both values).

- [ ] **Step 3: Confirm the ownership check on `compareDocumentId`**

While still logged in as the throwaway org, attempt (via `javascript_tool` fetch from the browser, or `curl` with no cookie) a chat request with a `compareDocumentId` belonging to a different organization (or a random UUID) — confirm the response is 404, not document content.

- [ ] **Step 4: Clean up test data**

Delete the throwaway organization, its user, both test documents (and their chunks), and any LangGraph checkpoint rows created (`public.checkpoints`/`checkpoint_writes`/`checkpoint_blobs` for the conversation's `thread_id`) directly in the database — same cleanup discipline as round 1. Remove the temporary `.env.local` copy and `.claude/launch.json` from the worktree.

- [ ] **Step 5: Report results**

Summarize pass/fail for typecheck, lint, vitest (all 11 test cases across the 3 files), and the live comparator + ownership checks. Do not merge/push until everything passes.
