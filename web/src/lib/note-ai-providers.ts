// How to talk to each AI service that can read a photo. Pure (no network), so the requests and answers are unit-tested.

export type AiProvider = "gemini" | "anthropic" | "openai" | "custom";
export const AI_PROVIDERS: AiProvider[] = ["gemini", "anthropic", "openai", "custom"];

export type AiConfig = { provider: AiProvider; key: string; model: string; baseUrl: string | null };
type Env = Record<string, string | undefined>;

const DEFAULT_MODEL: Record<AiProvider, string> = { gemini: "gemini-2.5-flash", anthropic: "claude-sonnet-5-5", openai: "gpt-4o", custom: "" };
const KEY_ENV: Record<AiProvider, string> = { gemini: "GEMINI_API_KEY", anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", custom: "NOTE_AI_API_KEY" };

/** The service in use and its key, or null if none is set up. With no choice made, the first service that has a key is used. */
export function aiConfig(env: Env): AiConfig | null {
  const chosen = AI_PROVIDERS.find((p) => p === env.NOTE_AI_PROVIDER);
  const provider = chosen ?? AI_PROVIDERS.find((p) => p !== "custom" && env[KEY_ENV[p]]);
  if (!provider) return null;
  const key = env[KEY_ENV[provider]];
  if (!key) return null;
  const baseUrl = provider === "custom" ? (env.NOTE_AI_BASE_URL ?? "").trim().replace(/\/+$/, "") || null : null;
  const model = (env.NOTE_AI_MODEL ?? "").trim() || DEFAULT_MODEL[provider];
  if (provider === "custom" && (!baseUrl || !model)) return null;
  return { provider, key, model, baseUrl };
}

export type AiRequest = { url: string; headers: Record<string, string>; body: unknown };

/** The request for one reading. With no image it is a plain text question, used to test the connection. */
export function buildRequest(cfg: AiConfig, prompt: string, image?: { base64: string; mime: string }): AiRequest {
  const json = { "content-type": "application/json" };
  if (cfg.provider === "anthropic") {
    return {
      url: "https://api.anthropic.com/v1/messages",
      headers: { ...json, "x-api-key": cfg.key, "anthropic-version": "2023-06-01" },
      body: { model: cfg.model, max_tokens: 4096, messages: [{ role: "user", content: [...(image ? [{ type: "image", source: { type: "base64", media_type: image.mime, data: image.base64 } }] : []), { type: "text", text: prompt }] }] },
    };
  }
  if (cfg.provider === "gemini") {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
      headers: { ...json, "x-goog-api-key": cfg.key },
      body: { contents: [{ role: "user", parts: [...(image ? [{ inline_data: { mime_type: image.mime, data: image.base64 } }] : []), { text: prompt }] }], generationConfig: { maxOutputTokens: 4096, temperature: 0 } },
    };
  }
  // OpenAI and anything that speaks the same chat format.
  const base = cfg.provider === "openai" ? "https://api.openai.com/v1" : cfg.baseUrl!;
  return {
    url: `${base}/chat/completions`,
    headers: { ...json, Authorization: `Bearer ${cfg.key}` },
    body: { model: cfg.model, max_tokens: 4096, messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...(image ? [{ type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } }] : [])] }] },
  };
}

type Json = Record<string, unknown>;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Json => (v && typeof v === "object" ? (v as Json) : {});

/** The text of the answer, from whichever shape the service replies in. */
export function answerText(provider: AiProvider, data: unknown): string {
  const d = obj(data);
  if (provider === "anthropic") return arr(d.content).map((c) => obj(c)).filter((c) => c.type === "text").map((c) => String(c.text ?? "")).join("\n");
  if (provider === "gemini") return arr(obj(arr(d.candidates)[0]).content ? obj(obj(arr(d.candidates)[0]).content).parts : []).map((p) => String(obj(p).text ?? "")).join("\n");
  const content = obj(obj(arr(d.choices)[0]).message).content;
  if (typeof content === "string") return content;
  return arr(content).map((p) => String(obj(p).text ?? "")).join("\n");
}

/** A short, safe explanation of a failed reply (never includes the key). */
export function failureText(status: number, data: unknown): string {
  const d = obj(data);
  const message = String(obj(d.error).message ?? d.message ?? "").slice(0, 160);
  if (status === 401 || status === 403) return "The service did not accept the key. Check that it is correct and has access to this model.";
  if (status === 404) return "The service does not know this model name. Check the model name.";
  if (status === 429) return "The service says too many requests or no credit left. Try again later, or check the account.";
  return message || `The service returned an error (${status}).`;
}
