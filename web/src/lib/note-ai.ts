import "server-only";
import { NOTE_PROMPT, parseNoteResponse, type ParsedNote } from "./note-parse";
import { aiConfig, answerText, buildRequest, failureText } from "./note-ai-providers";

// Reading a photo of a paper note with an AI service chosen by the platform admin (Platform admin > Connections).
// The photo is sent to that service for this one reading and is not kept by us anywhere else; the Privacy Policy tells shop owners this.

export const noteAiOn = () => aiConfig(process.env) !== null;
export const noteFreePerMonth = () => {
  const n = Number(process.env.NOTE_SCAN_FREE_PER_MONTH);
  return Number.isInteger(n) && n >= 0 ? n : 30;
};

export type ReadResult = { ok: true; note: ParsedNote } | { ok: false; error: string };

async function ask(prompt: string, image?: { base64: string; mime: string }): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const cfg = aiConfig(process.env);
  if (!cfg) return { ok: false, error: "Reading photos is not switched on yet." };
  const req = buildRequest(cfg, prompt, image);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 90_000);
  try {
    const res = await fetch(req.url, { method: "POST", signal: ctl.signal, headers: req.headers, body: JSON.stringify(req.body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("note reading failed", cfg.provider, res.status);
      return { ok: false, error: failureText(res.status, data) };
    }
    return { ok: true, text: answerText(cfg.provider, data) };
  } catch (e) {
    console.error("note reading error", cfg.provider, e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "The service could not be reached in time. Please try again." };
  } finally {
    clearTimeout(timer);
  }
}

export async function readNoteImage(bytes: Uint8Array, mime: string, today: string): Promise<ReadResult> {
  const r = await ask(NOTE_PROMPT, { base64: Buffer.from(bytes).toString("base64"), mime });
  if (!r.ok) return r;
  return { ok: true, note: parseNoteResponse(r.text, today) };
}

/** A one-line question with no photo, to check that the chosen service and key work. */
export async function testNoteAi(): Promise<{ ok: boolean; message: string }> {
  const cfg = aiConfig(process.env);
  if (!cfg) return { ok: false, message: "Choose a service and add its key first." };
  const r = await ask("Reply with the single word OK.");
  return r.ok ? { ok: true, message: `Connected to ${cfg.provider} (${cfg.model}).` } : { ok: false, message: r.error };
}
