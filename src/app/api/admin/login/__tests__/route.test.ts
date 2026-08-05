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

// The route calls cookies() from next/headers, which requires a real
// Next.js App Router request context. Outside that context it throws
// (observed as a 500 from the route's catch block), so it's mocked here.
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: vi.fn() })),
}));

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
    // Default to a successful password check; tests that need to exercise
    // the rejection/throw paths override this explicitly.
    authMocks.verifyPassword.mockResolvedValue(true);
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
