import "server-only";
import { NOTE_PROMPT, parseNoteResponse, type ParsedNote } from "./note-parse";

// Reading a photo of a paper note with an AI model. The photo is sent to the AI provider (Anthropic) for this one
// reading and is not used to train anything; the Privacy Policy tells shop owners this.

export const noteAiOn = () => !!process.env.ANTHROPIC_API_KEY;
export const noteFreePerMonth = () => {
  const n = Number(process.env.NOTE_SCAN_FREE_PER_MONTH);
  return Number.isInteger(n) && n >= 0 ? n : 30;
};

export type ReadResult = { ok: true; note: ParsedNote } | { ok: false; error: string };

export async function readNoteImage(bytes: Uint8Array, mime: string, today: string): Promise<ReadResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, error: "Reading photos is not switched on yet." };
  const model = process.env.NOTE_AI_MODEL || "claude-sonnet-5-5";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: Buffer.from(bytes).toString("base64") } }, { type: "text", text: NOTE_PROMPT }] }],
      }),
    });
    if (res.status === 429 || res.status === 529) return { ok: false, error: "The reading service is busy right now. Please try again in a minute." };
    if (!res.ok) {
      console.error("note reading failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return { ok: false, error: "The photo could not be read right now. Please try again." };
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n");
    return { ok: true, note: parseNoteResponse(text, today) };
  } catch (e) {
    console.error("note reading error", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "The photo could not be read in time. Please try again." };
  } finally {
    clearTimeout(timer);
  }
}
