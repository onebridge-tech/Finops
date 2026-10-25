import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { profileFromCode } = await import("./google");

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("profileFromCode", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "client-123";
    process.env.GOOGLE_CLIENT_SECRET = "secret-xyz";
    process.env.APP_URL = "https://finops.example.in/";
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("logs Google's reason when the code exchange is refused, without the secret", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json(401, { error: "invalid_client", error_description: "Unauthorized" }));
    expect(await profileFromCode("code", "verifier")).toBeNull();
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain("invalid_client");
    expect(line).toContain("redirect_uri=https://finops.example.in/api/auth/google/callback");
    expect(line).not.toContain("secret-xyz");
  });

  it("logs a token meant for another app", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(200, { id_token: "t" }))
      .mockResolvedValueOnce(json(200, { aud: "someone-else", iss: "https://accounts.google.com", sub: "1", email: "a@b.in", email_verified: "true" }));
    expect(await profileFromCode("code", "verifier")).toBeNull();
    expect(String(warn.mock.calls[0][0])).toContain("different client ID");
  });

  it("returns the profile when everything checks out", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(200, { id_token: "t" }))
      .mockResolvedValueOnce(json(200, { aud: "client-123", iss: "accounts.google.com", sub: "42", email: "Ravi@Shop.in", email_verified: true, name: "Ravi" }));
    expect(await profileFromCode("code", "verifier")).toEqual({ sub: "42", email: "ravi@shop.in", name: "Ravi" });
    expect(warn).not.toHaveBeenCalled();
  });
});
