import { createHmac, timingSafeEqual } from "node:crypto";

// Payment gateway adapters (CP-05). TEST mode needs no account: the customer sees a
// "Pay (test)" page and nothing is charged. Razorpay and Cashfree create a hosted
// payment link and tell us the result through a signed webhook.
//
// The Razorpay and Cashfree calls follow their public docs but have not been run against
// real accounts yet; try them in each provider's sandbox before going live.

export type GatewayName = "test" | "razorpay" | "cashfree";

/** The gateway in use, or null when none may be offered (production without keys). */
export function gatewayMode(): GatewayName | null {
  const p = process.env.PAYMENT_PROVIDER;
  if (p === "razorpay" && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) return "razorpay";
  if (p === "cashfree" && process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET) return "cashfree";
  if (process.env.NODE_ENV !== "production" || process.env.PAYMENT_TEST_MODE === "1") return "test";
  return null;
}

export type CreateOrder = { amountPaise: number; reference: string; description: string; phone?: string | null; returnUrl: string };
export type CreatedOrder = { providerOrderId: string; checkoutUrl: string | null };

export type PaymentEvent = { providerOrderId: string; providerPaymentId: string | null; status: "PAID" | "FAILED"; amountPaise: number };

export async function createOrder(g: GatewayName, o: CreateOrder): Promise<CreatedOrder> {
  if (g === "test") return { providerOrderId: `test_${o.reference}`, checkoutUrl: null };
  if (g === "razorpay") {
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const res = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: o.amountPaise, currency: "INR", reference_id: o.reference, description: o.description.slice(0, 2000),
        callback_url: o.returnUrl, callback_method: "get", ...(o.phone ? { customer: { contact: `+${o.phone}` } } : {}),
      }),
    });
    const j = (await res.json()) as { id?: string; short_url?: string; error?: { description?: string } };
    if (!res.ok || !j.id || !j.short_url) throw new Error(j.error?.description ?? "The payment provider didn’t accept the request");
    return { providerOrderId: j.id, checkoutUrl: j.short_url };
  }
  const res = await fetch(`${process.env.CASHFREE_BASE_URL ?? "https://api.cashfree.com/pg"}/links`, {
    method: "POST",
    headers: { "x-client-id": process.env.CASHFREE_APP_ID!, "x-client-secret": process.env.CASHFREE_SECRET!, "x-api-version": "2023-08-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      link_id: o.reference, link_amount: Number((o.amountPaise / 100).toFixed(2)), link_currency: "INR", link_purpose: o.description.slice(0, 500),
      customer_details: { customer_phone: (o.phone ?? "9999999999").slice(-10) }, link_meta: { return_url: o.returnUrl },
    }),
  });
  const j = (await res.json()) as { link_id?: string; link_url?: string; message?: string };
  if (!res.ok || !j.link_id || !j.link_url) throw new Error(j.message ?? "The payment provider didn’t accept the request");
  return { providerOrderId: j.link_id, checkoutUrl: j.link_url };
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Checks the webhook signature and returns the payment result, or null if it isn't one we act on. */
export function readWebhook(g: Exclude<GatewayName, "test">, raw: string, h: Headers): { valid: boolean; event: PaymentEvent | null } {
  let body: Json;
  try { body = JSON.parse(raw) as Json; } catch { return { valid: false, event: null }; }
  if (g === "razorpay") {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const sig = h.get("x-razorpay-signature");
    if (!secret || !sig || !safeEqual(createHmac("sha256", secret).update(raw).digest("hex"), sig)) return { valid: false, event: null };
    const link = body.payload?.payment_link?.entity as Json | undefined;
    const pay = body.payload?.payment?.entity as Json | undefined;
    if (body.event === "payment_link.paid" && link?.id) {
      return { valid: true, event: { providerOrderId: String(link.id), providerPaymentId: pay?.id ? String(pay.id) : null, status: "PAID", amountPaise: Number(pay?.amount ?? link.amount_paid ?? 0) } };
    }
    if ((body.event === "payment_link.expired" || body.event === "payment_link.cancelled") && link?.id) {
      return { valid: true, event: { providerOrderId: String(link.id), providerPaymentId: null, status: "FAILED", amountPaise: 0 } };
    }
    return { valid: true, event: null };
  }
  const secret = process.env.CASHFREE_SECRET;
  const sig = h.get("x-webhook-signature");
  const ts = h.get("x-webhook-timestamp");
  if (!secret || !sig || !ts || !safeEqual(createHmac("sha256", secret).update(ts + raw).digest("base64"), sig)) return { valid: false, event: null };
  const d = body.data as Json | undefined;
  const linkId = d?.link_id;
  const status = String(d?.link_status ?? "").toUpperCase();
  if (linkId && status === "PAID") {
    return { valid: true, event: { providerOrderId: String(linkId), providerPaymentId: d?.cf_link_id ? String(d.cf_link_id) : null, status: "PAID", amountPaise: Math.round(Number(d?.link_amount_paid ?? 0) * 100) } };
  }
  if (linkId && (status === "EXPIRED" || status === "CANCELLED")) {
    return { valid: true, event: { providerOrderId: String(linkId), providerPaymentId: null, status: "FAILED", amountPaise: 0 } };
  }
  return { valid: true, event: null };
}
