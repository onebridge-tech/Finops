import "server-only";
import { randomBytes } from "node:crypto";
import type { Channel } from "../reminder-rule";
import type { MessageKind } from "./templates";

// Outbound message providers. Each channel uses the provider named in its env var;
// when none is set the channel runs in TEST mode: nothing leaves the server, the
// message is stored and marked delivered so every flow can be exercised end to end.
//
//   WHATSAPP_PROVIDER=meta    WhatsApp Cloud API   (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE_PREFIX)
//   SMS_PROVIDER=msg91        MSG91 Flow API (DLT) (MSG91_AUTH_KEY, MSG91_TEMPLATE_<KIND>)
//   EMAIL_PROVIDER=resend     Resend               (RESEND_API_KEY, EMAIL_FROM)

export type Outbound = { channel: Channel; to: string; body: string; subject: string; kind: MessageKind; lang: string; params: string[] };
export type SendResult =
  | { ok: true; provider: string; id: string; status: "SENT" | "DELIVERED" }
  | { ok: false; provider: string; error: string };

const ENV: Record<Channel, string> = { WHATSAPP: "WHATSAPP_PROVIDER", SMS: "SMS_PROVIDER", EMAIL: "EMAIL_PROVIDER" };

export function providerName(channel: Channel): string {
  return process.env[ENV[channel]] || "test";
}

export function isTestMode(channel: Channel): boolean {
  return providerName(channel) === "test";
}

export async function deliver(m: Outbound): Promise<SendResult> {
  const name = providerName(m.channel);
  try {
    switch (`${m.channel}:${name}`) {
      case "WHATSAPP:meta": return await metaWhatsApp(m);
      case "SMS:msg91": return await msg91(m);
      case "EMAIL:resend": return await resend(m);
      default:
        if (name !== "test") return { ok: false, provider: name, error: `Unknown ${m.channel} provider "${name}"` };
        return testProvider(m);
    }
  } catch (e) {
    return { ok: false, provider: name, error: e instanceof Error ? e.message : String(e) };
  }
}

function testProvider(m: Outbound): SendResult {
  console.log(`[test ${m.channel}] to ${m.to}: ${m.body}`);
  return { ok: true, provider: "test", id: `test_${randomBytes(8).toString("hex")}`, status: "DELIVERED" };
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

async function metaWhatsApp(m: Outbound): Promise<SendResult> {
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${required("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${required("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: m.to,
      type: "template",
      template: {
        name: `${process.env.WHATSAPP_TEMPLATE_PREFIX ?? ""}${m.kind.toLowerCase()}`,
        language: { code: m.lang },
        components: [{ type: "body", parameters: m.params.map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok || !data.messages?.[0]) return { ok: false, provider: "meta", error: data.error?.message ?? `HTTP ${res.status}` };
  return { ok: true, provider: "meta", id: data.messages[0].id, status: "SENT" };
}

async function msg91(m: Outbound): Promise<SendResult> {
  const vars = Object.fromEntries(m.params.map((p, i) => [`VAR${i + 1}`, p]));
  const res = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: { authkey: required("MSG91_AUTH_KEY"), "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ template_id: required(`MSG91_TEMPLATE_${m.kind}`), short_url: "0", recipients: [{ mobiles: m.to, ...vars }] }),
  });
  const data = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
  if (!res.ok || data.type !== "success") return { ok: false, provider: "msg91", error: data.message ?? `HTTP ${res.status}` };
  return { ok: true, provider: "msg91", id: data.message ?? "", status: "SENT" };
}

async function resend(m: Outbound): Promise<SendResult> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${required("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: required("EMAIL_FROM"), to: [m.to], subject: m.subject, text: m.body }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !data.id) return { ok: false, provider: "resend", error: data.message ?? `HTTP ${res.status}` };
  return { ok: true, provider: "resend", id: data.id, status: "SENT" };
}
