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
