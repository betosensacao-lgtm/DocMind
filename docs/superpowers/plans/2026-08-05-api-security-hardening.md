# API Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every docmind API route that touches document/organization data require a real, server-verified admin session, scoped strictly to that session's `organizationId`, and close the admin-login backdoor that lets anyone become admin of an existing organization.

**Architecture:** Add a small shared helper (`src/lib/api-auth.ts`) that extracts and verifies the `admin_session` cookie from a plain `Request`/`NextRequest` (same pattern already used by `/api/admin/me` and `/api/drive/*`). Every document/admin route calls it first and returns 401 if there's no valid session, then uses `session.organizationId` for every query — the client-sent `x-organization-id` header is deleted from the codebase entirely. `JWT_SECRET` moves into its own edge-safe module so both `src/lib/auth.ts` (Node runtime) and `src/proxy.ts` (Edge runtime) share one fail-fast check.

**Tech Stack:** Next.js 16 App Router route handlers, `jose` (JWT), `drizzle-orm`, Postgres via `postgres` driver. No test framework is configured in this repo — verification steps below are manual (`curl` + browser), not automated tests.

---

## File Structure

- Create `src/lib/jwt-secret.ts` — shared JWT secret constant, fails fast in production if unset. Both `src/lib/auth.ts` and `src/proxy.ts` import from here instead of each reading `process.env.JWT_SECRET` themselves.
- Create `src/lib/api-auth.ts` — `getSessionFromRequest(request)` helper, reused by every route below and by `/api/admin/me` (refactored to drop its duplicate cookie-parsing).
- Modify `src/lib/auth.ts` — use the new `JWT_SECRET` import.
- Modify `src/proxy.ts` — use the new `JWT_SECRET` import.
- Modify `src/app/api/documents/route.ts` — remove `getValidOrgId`, require session, scope insert/list to `session.organizationId`.
- Modify `src/app/api/documents/[id]/route.ts` — require session, verify document ownership before returning/deleting.
- Modify `src/app/api/admin/documents/route.ts` — require session, ignore the header, scope to `session.organizationId`.
- Modify `src/app/api/admin/stats/route.ts` — require session, scope counts to `session.organizationId`; also fixes a pre-existing bug where `readyDocuments` was computed with the exact same (unfiltered by status) query as `totalDocuments`.
- Modify `src/app/api/admin/me/route.ts` — use the shared helper (dedupe).
- Modify `src/app/api/admin/login/route.ts` — restrict admin auto-create to a true empty-database bootstrap; fail closed on password-verification errors.
- Modify `src/db/seed.ts` — don't print the plaintext seed password when `NODE_ENV=production`.
- Modify `src/app/documents/[id]/page.tsx` — redirect to `/admin/login` on a 401 instead of spinning forever (this page will start receiving 401s from unauthenticated visitors once the API is locked down).

---

### Task 1: Shared fail-fast JWT secret

**Files:**
- Create: `src/lib/jwt-secret.ts`
- Modify: `src/lib/auth.ts:10`
- Modify: `src/proxy.ts:7`

- [ ] **Step 1: Create the shared secret module**

```ts
// src/lib/jwt-secret.ts
const secret = process.env.JWT_SECRET;

if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable must be set in production");
}

export const JWT_SECRET = new TextEncoder().encode(
  secret ?? "dev-secret-insecure-do-not-use-in-production"
);
```

- [ ] **Step 2: Point `src/lib/auth.ts` at it**

Replace line 10 of `src/lib/auth.ts`:

```ts
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");
```

with:

```ts
import { JWT_SECRET } from "@/lib/jwt-secret";
```

(add the import near the top with the other imports; remove the old `const JWT_SECRET = ...` line).

- [ ] **Step 3: Point `src/proxy.ts` at it**

Replace line 7 of `src/proxy.ts`:

```ts
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret");
```

with:

```ts
import { JWT_SECRET } from "@/lib/jwt-secret";
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jwt-secret.ts src/lib/auth.ts src/proxy.ts
git commit -m "fix(docmind): fail fast on missing JWT_SECRET in production"
```

---

### Task 2: Shared session-verification helper for API routes

**Files:**
- Create: `src/lib/api-auth.ts`
- Modify: `src/app/api/admin/me/route.ts`

- [ ] **Step 1: Create the helper**

```ts
// src/lib/api-auth.ts
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import type { AdminSession } from "@/types";

export async function getSessionFromRequest(request: Request): Promise<AdminSession | null> {
  const cookie = (request.headers.get("cookie") || "")
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_NAME}=`))
    ?.split("=")[1];

  if (!cookie) return null;

  try {
    return await verifySessionToken(cookie);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Refactor `/api/admin/me` to use it**

Replace the full contents of `src/app/api/admin/me/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: session.userId,
    name: session.email?.split("@")[0] || "Admin",
    email: session.email,
    role: session.role,
    organizationId: session.organizationId,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-auth.ts src/app/api/admin/me/route.ts
git commit -m "refactor(docmind): extract shared getSessionFromRequest helper"
```

---

### Task 3: Lock down `/api/documents` (upload + list)

**Files:**
- Modify: `src/app/api/documents/route.ts`

- [ ] **Step 1: Replace the file**

Replace the full contents of `src/app/api/documents/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { documents, documentChunks } from "@/db/schema";
import { parseDocument, chunkText } from "@/lib/documents/parser";
import { generateEmbedding } from "@/lib/embeddings";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const orgId = session.organizationId;

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Nenhum arquivo fornecido" }, { status: 400 });

    const isVercel = Boolean(process.env.VERCEL || process.env.NEXT_RUNTIME === "edge");
    const uploadDir = isVercel ? "/tmp" : (process.env.UPLOAD_DIR || "/tmp");

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {}

    const ext = path.extname(file.name);
    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await writeFile(filePath, buffer);
    } catch (writeErr) {
      console.warn("[UPLOAD DIR WRITE WARN]", writeErr);
    }

    const mimeType = file.type || "application/octet-stream";

    let text = "";
    let pages = 1;

    try {
      const parsed = await parseDocument(filePath, mimeType);
      text = parsed.text;
      pages = parsed.pages || 1;
    } catch {
      text = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
    }

    if (!text || !text.trim()) {
      text = `Conteúdo do documento ${file.name} registrado com sucesso no sistema DocMind.`;
    }

    const [doc] = await db.insert(documents).values({
      organizationId: orgId,
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      filePath,
      pageCount: pages,
      textContent: text,
      status: "READY",
    } as any).returning();

    // Chunk text and vector embeddings
    if (text) {
      const chunks = chunkText(text, 1000);
      for (let i = 0; i < chunks.length; i++) {
        try {
          const embedding = await generateEmbedding(chunks[i]);
          await db.insert(documentChunks).values({
            documentId: doc.id,
            content: chunks[i],
            embedding,
            chunkIndex: i,
          } as any);
        } catch (embErr) {
          console.warn(`[EMBEDDING CHUNK ${i} WARN]`, embErr);
        }
      }
    }

    return NextResponse.json({
      id: doc.id,
      fileName: file.name,
      status: "READY",
      pageCount: pages,
      textLength: text.length,
      chunksCount: chunkText(text, 1000).length
    }, { status: 201 });
  } catch (error) {
    console.error("[UPLOAD ERROR]", error);
    return NextResponse.json({ error: "Erro ao fazer upload do documento: " + String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.organizationId, session.organizationId))
      .orderBy(documents.createdAt);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[FETCH DOCUMENTS ERROR]", error);
    return NextResponse.json([], { status: 500 });
  }
}
```

Note: `getValidOrgId` and the `organizations` import are gone — there is no more header-based/fallback org resolution.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/documents/route.ts
git commit -m "fix(docmind): require auth session for document upload/list, drop header-trusted org id"
```

---

### Task 4: Lock down `/api/documents/[id]` (get + delete)

**Files:**
- Modify: `src/app/api/documents/[id]/route.ts`

- [ ] **Step 1: Replace the file**

```ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, documentChunks, extractions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc || doc.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const chunks = await db.select().from(documentChunks).where(eq(documentChunks.documentId, id)).orderBy(documentChunks.chunkIndex);
    const extracted = await db.select().from(extractions).where(eq(extractions.documentId, id));

    return NextResponse.json({
      ...doc,
      chunks,
      extractions: extracted
    });
  } catch (error) {
    console.error("[GET DOC ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch document" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc || doc.organizationId !== session.organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await db.delete(extractions).where(eq(extractions.documentId, id));
    await db.delete(documentChunks).where(eq(documentChunks.documentId, id));
    await db.delete(documents).where(eq(documents.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE DOC ERROR]", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/documents/[id]/route.ts"
git commit -m "fix(docmind): require auth + org ownership check for document get/delete"
```

---

### Task 5: Lock down `/api/admin/documents` and `/api/admin/stats`

**Files:**
- Modify: `src/app/api/admin/documents/route.ts`
- Modify: `src/app/api/admin/stats/route.ts`

- [ ] **Step 1: Replace `src/app/api/admin/documents/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        fileType: documents.fileType,
        fileSize: documents.fileSize,
        status: documents.status,
        pageCount: documents.pageCount,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.organizationId, session.organizationId))
      .orderBy(documents.createdAt);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ADMIN DOCS GET ERROR]", error);
    return NextResponse.json([]);
  }
}
```

- [ ] **Step 2: Replace `src/app/api/admin/stats/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/db";
import { documents, extractions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSessionFromRequest } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [totalDocs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(eq(documents.organizationId, session.organizationId));

    const [readyDocs] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(and(eq(documents.organizationId, session.organizationId), eq(documents.status, "READY")));

    const [totalExtractions] = await db
      .select({ count: sql<number>`count(*)` })
      .from(extractions)
      .innerJoin(documents, eq(extractions.documentId, documents.id))
      .where(eq(documents.organizationId, session.organizationId));

    return NextResponse.json({
      totalDocuments: Number(totalDocs?.count ?? 0),
      readyDocuments: Number(readyDocs?.count ?? 0),
      totalExtractions: Number(totalExtractions?.count ?? 0),
    });
  } catch (error) {
    console.error("[ADMIN STATS GET ERROR]", error);
    return NextResponse.json({
      totalDocuments: 0,
      readyDocuments: 0,
      totalExtractions: 0,
    });
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/documents/route.ts src/app/api/admin/stats/route.ts
git commit -m "fix(docmind): require auth + scope admin documents/stats to session org"
```

---

### Task 6: Close the admin-login backdoor

**Files:**
- Modify: `src/app/api/admin/login/route.ts`

- [ ] **Step 1: Replace the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, verifyPassword, createSessionToken, updateLastLogin, hashPassword } from "@/lib/auth";
import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });

    const cleanEmail = email.trim().toLowerCase();
    let user = await getUserByEmail(cleanEmail).catch(() => null);

    // Bootstrap: só cria o primeiro admin automaticamente quando NÃO existe
    // absolutamente nenhum usuário no banco (primeiríssimo login em produção).
    if (!user) {
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
      const isBootstrap = Number(count) === 0;

      if (isBootstrap) {
        try {
          let orgList = await db.select().from(organizations).limit(1);
          let org = orgList[0];
          if (!org) {
            [org] = await db.insert(organizations).values({
              name: "DocMind Org",
              slug: `docmind-${Date.now()}`,
            } as any).returning();
          }

          const passwordHash = await hashPassword(password);
          const [newUser] = await db.insert(users).values({
            organizationId: org.id,
            email: cleanEmail,
            name: cleanEmail.split("@")[0],
            role: "admin",
            passwordHash,
            active: true,
          } as any).returning();
          user = newUser;
        } catch (insertErr) {
          console.warn("[BOOTSTRAP ADMIN CREATE WARN]", insertErr);
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    // Verificar senha — fail closed: qualquer erro na verificação nega o login.
    const isValid = await verifyPassword(password, user.passwordHash).catch(() => false);
    if (!isValid) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    if (!user.active) {
      return NextResponse.json({ error: "Usuário desativado" }, { status: 403 });
    }

    const token = await createSessionToken({
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    });

    await updateLastLogin(user.id).catch(() => null);

    const response = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

    response.cookies.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });

    const cookieStore = await cookies();
    cookieStore.set("admin_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });

    return response;
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json({ error: "Erro interno no servidor" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/login/route.ts
git commit -m "fix(docmind): restrict admin auto-create to empty-database bootstrap, fail closed on password check"
```

---

### Task 7: Don't print the seed admin password in production

**Files:**
- Modify: `src/db/seed.ts`

- [ ] **Step 1: Edit the log line**

Replace:

```ts
  console.log("Seed done! admin@demo.com / ccEH@fNU7VEhbccW");
```

with:

```ts
  if (process.env.NODE_ENV === "production") {
    console.log("Seed done! Admin user admin@demo.com created (password not printed in production).");
  } else {
    console.log("Seed done! admin@demo.com / ccEH@fNU7VEhbccW");
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/db/seed.ts
git commit -m "fix(docmind): stop printing seed admin password in production logs"
```

---

### Task 8: Fix the public document-detail page's 401 handling

**Files:**
- Modify: `src/app/documents/[id]/page.tsx`

Once Task 4 ships, an unauthenticated visit to `/documents/[id]` gets a 401
from the API instead of the document — right now the page just spins
forever. Redirect to login instead.

- [ ] **Step 1: Add the router import and redirect-on-401**

In `src/app/documents/[id]/page.tsx`, change:

```ts
import { useParams } from "next/navigation";
```

to:

```ts
import { useParams, useRouter } from "next/navigation";
```

Add inside the component, right after `const id = params?.id as string;`:

```ts
  const router = useRouter();
```

Then replace the fetch effect:

```ts
  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setDoc(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);
```

with:

```ts
  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((r) => {
        if (r.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data?.id) setDoc(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, router]);
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/documents/[id]/page.tsx"
git commit -m "fix(docmind): redirect to login when document detail page gets 401"
```

---

### Task 9: Full manual verification (no test framework in this repo)

**Files:** none (verification only)

- [ ] **Step 1: Typecheck and lint the whole project**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 2: Start the dev server**

Run: `pnpm dev` (leave running)

- [ ] **Step 3: Confirm every locked-down route rejects anonymous requests**

Run each and confirm HTTP 401:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/documents
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/documents
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/documents
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/stats
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/documents/00000000-0000-0000-0000-000000000000
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/api/documents/00000000-0000-0000-0000-000000000000
```

- [ ] **Step 4: Confirm the login backdoor is closed**

With the seeded/existing admin already in the database (`count(*) from
docmind_users` > 0), confirm a never-used email is rejected instead of
auto-creating an admin:

```bash
curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker-test@example.com","password":"whatever"}'
```

Expected: `{"error":"Credenciais inválidas"}` with 401, and no new row in
`docmind_users` for that email (spot-check with `pnpm db:studio` or a quick
`select` — don't leave the check query running).

- [ ] **Step 5: Confirm cross-tenant isolation in the browser**

Using the browser preview:
1. Go to `/admin/signup`, create org "Verify Org A" with a throwaway email
   (e.g. `verify-a-<timestamp>@example.com`).
2. Upload a small `.txt` file from `/admin/documents`, confirm it appears.
3. Log out, go to `/admin/signup`, create org "Verify Org B" with another
   throwaway email.
4. On `/admin/documents` as Org B, confirm Org A's document is **not**
   listed.
5. Copy Org A's document id from step 2 (or from the DB) and, while logged
   in as Org B, hit `GET /api/documents/<orgA-doc-id>` — confirm 404, not
   the document content.

- [ ] **Step 6: Clean up test data**

Delete the two throwaway orgs/users/documents created in Step 5 directly in
the database (`pnpm db:studio` or a one-off `tsx` script that is not
committed) so no test data is left behind.

- [ ] **Step 7: Report results**

Summarize pass/fail for each check above before considering this plan done.
Do not merge/push until every check in this task passes.
