import { describe, expect, it } from "vitest";
import { aiConfig, answerText, buildRequest, failureText } from "./note-ai-providers";

describe("aiConfig", () => {
  it("uses the chosen service and its key", () => {
    expect(aiConfig({ NOTE_AI_PROVIDER: "gemini", GEMINI_API_KEY: "g" })).toMatchObject({ provider: "gemini", model: "gemini-2.5-flash" });
    expect(aiConfig({ NOTE_AI_PROVIDER: "openai", OPENAI_API_KEY: "o", NOTE_AI_MODEL: "gpt-4o-mini" })).toMatchObject({ provider: "openai", model: "gpt-4o-mini" });
  });
  it("falls back to the first service that has a key when none is chosen", () => {
    expect(aiConfig({ ANTHROPIC_API_KEY: "a" })?.provider).toBe("anthropic");
    expect(aiConfig({})).toBeNull();
  });
  it("is off when the chosen service has no key", () => {
    expect(aiConfig({ NOTE_AI_PROVIDER: "gemini", ANTHROPIC_API_KEY: "a" })).toBeNull();
  });
  it("needs an address and a model for another service", () => {
    expect(aiConfig({ NOTE_AI_PROVIDER: "custom", NOTE_AI_API_KEY: "k" })).toBeNull();
    expect(aiConfig({ NOTE_AI_PROVIDER: "custom", NOTE_AI_API_KEY: "k", NOTE_AI_BASE_URL: "https://x.test/v1/", NOTE_AI_MODEL: "m" })).toMatchObject({ baseUrl: "https://x.test/v1" });
  });
});

describe("buildRequest and answerText", () => {
  const img = { base64: "AAA", mime: "image/jpeg" };
  it("builds an Anthropic request and reads its answer", () => {
    const r = buildRequest({ provider: "anthropic", key: "k", model: "m", baseUrl: null }, "hi", img);
    expect(r.url).toContain("anthropic.com");
    expect(r.headers["x-api-key"]).toBe("k");
    expect(JSON.stringify(r.body)).toContain('"media_type":"image/jpeg"');
    expect(answerText("anthropic", { content: [{ type: "text", text: "A" }, { type: "text", text: "B" }] })).toBe("A\nB");
  });
  it("builds a Gemini request and reads its answer", () => {
    const r = buildRequest({ provider: "gemini", key: "k", model: "gemini-2.5-flash", baseUrl: null }, "hi", img);
    expect(r.url).toContain("models/gemini-2.5-flash:generateContent");
    expect(r.headers["x-goog-api-key"]).toBe("k");
    expect(JSON.stringify(r.body)).toContain('"mime_type":"image/jpeg"');
    expect(answerText("gemini", { candidates: [{ content: { parts: [{ text: "{\"rows\":[]}" }] } }] })).toBe('{"rows":[]}');
  });
  it("builds an OpenAI-style request, for OpenAI and for other services", () => {
    const o = buildRequest({ provider: "openai", key: "k", model: "gpt-4o", baseUrl: null }, "hi", img);
    expect(o.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(o.headers.Authorization).toBe("Bearer k");
    expect(JSON.stringify(o.body)).toContain("data:image/jpeg;base64,AAA");
    const c = buildRequest({ provider: "custom", key: "k", model: "m", baseUrl: "https://x.test/v1" }, "hi");
    expect(c.url).toBe("https://x.test/v1/chat/completions");
    expect(JSON.stringify(c.body)).not.toContain("image_url");
    expect(answerText("openai", { choices: [{ message: { content: "OK" } }] })).toBe("OK");
  });
  it("returns nothing for an unexpected reply", () => {
    expect(answerText("gemini", {})).toBe("");
    expect(answerText("openai", null)).toBe("");
  });
});

describe("failureText", () => {
  it("explains common failures without showing anything secret", () => {
    expect(failureText(401, {})).toMatch(/did not accept the key/);
    expect(failureText(404, {})).toMatch(/model name/);
    expect(failureText(429, {})).toMatch(/too many requests|credit/);
    expect(failureText(500, { error: { message: "boom" } })).toBe("boom");
  });
});
