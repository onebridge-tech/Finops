import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { applyDeliveryStatus } from "@/lib/messaging/send";
import { recordOptOut } from "@/lib/consent";

// WhatsApp Cloud API webhook (IN-05): delivery/read receipts and STOP replies.

/** Subscription handshake from Meta. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
  return ok && process.env.WHATSAPP_VERIFY_TOKEN
    ? new Response(url.searchParams.get("hub.challenge") ?? "")
    : new Response("Forbidden", { status: 403 });
}

type Payload = {
  entry?: {
    changes?: {
      value?: {
        statuses?: { id: string; status: string; timestamp: string; errors?: { title?: string }[] }[];
        messages?: { from: string; type: string; text?: { body?: string }; button?: { text?: string } }[];
      };
    }[];
  }[];
};

const STATUS: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
const STOP_WORDS = /^\s*(stop|unsubscribe|band karo|बंद|ఆపండి)\s*$/i;

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("Webhook not configured", { status: 503 });
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`);
  const given = Buffer.from(request.headers.get("x-hub-signature-256") ?? "");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return new Response("Bad signature", { status: 401 });

  const payload = JSON.parse(raw) as Payload;
  for (const change of payload.entry?.flatMap((e) => e.changes ?? []) ?? []) {
    for (const s of change.value?.statuses ?? []) {
      const status = STATUS[s.status];
      if (status) await applyDeliveryStatus(s.id, status, new Date(Number(s.timestamp) * 1000), s.errors?.[0]?.title);
    }
    for (const m of change.value?.messages ?? []) {
      const text = m.text?.body ?? m.button?.text ?? "";
      if (!STOP_WORDS.test(text)) continue;
      // A STOP reply opts the sender out of WhatsApp for every business that messages them.
      const parties = await db.party.findMany({ where: { phone: m.from, whatsappOptOutAt: null } });
      for (const p of parties) await recordOptOut(p, "WHATSAPP", "PROVIDER");
    }
  }
  return new Response("ok");
}
