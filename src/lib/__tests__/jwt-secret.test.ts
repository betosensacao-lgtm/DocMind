import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("jwt-secret", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when JWT_SECRET is unset in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", undefined);

    await expect(import("../jwt-secret")).rejects.toThrow(
      "JWT_SECRET environment variable must be set in production"
    );
  });

  it("does not throw when JWT_SECRET is set in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "a-real-secret");

    const { JWT_SECRET } = await import("../jwt-secret");
    expect(JWT_SECRET).toBeInstanceOf(Uint8Array);
  });

  it("falls back to a dev secret outside production when unset", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("JWT_SECRET", undefined);

    const { JWT_SECRET } = await import("../jwt-secret");
    expect(JWT_SECRET).toBeInstanceOf(Uint8Array);
  });
});
