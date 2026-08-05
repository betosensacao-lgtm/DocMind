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
