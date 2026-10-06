import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gatewayMode, readWebhook } from "./gateway";

afterEach(() => vi.unstubAllEnvs());

describe("readWebhook (Razorpay)", () => {
  const body = JSON.stringify({ event: "payment_link.paid", payload: { payment_link: { entity: { id: "plink_1" } }, payment: { entity: { id: "pay_9", amount: 132750 } } } });
  const sign = (b: string, s: string) => createHmac("sha256", s).update(b).digest("hex");

  it("accepts a correctly signed paid event", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec");
    const r = readWebhook("razorpay", body, new Headers({ "x-razorpay-signature": sign(body, "whsec") }));
    expect(r.valid).toBe(true);
    expect(r.event).toEqual({ providerOrderId: "plink_1", providerPaymentId: "pay_9", status: "PAID", amountPaise: 132750 });
  });
  it("rejects a wrong or missing signature", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec");
    expect(readWebhook("razorpay", body, new Headers({ "x-razorpay-signature": sign(body, "other") })).valid).toBe(false);
    expect(readWebhook("razorpay", body, new Headers()).valid).toBe(false);
  });
  it("rejects everything when no secret is configured", () => {
    expect(readWebhook("razorpay", body, new Headers({ "x-razorpay-signature": sign(body, "") })).valid).toBe(false);
  });
  it("ignores unrelated events but still reports them valid", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec");
    const b = JSON.stringify({ event: "payment.authorized", payload: {} });
    const r = readWebhook("razorpay", b, new Headers({ "x-razorpay-signature": sign(b, "whsec") }));
    expect(r).toEqual({ valid: true, event: null });
  });
});

describe("readWebhook (Cashfree)", () => {
  it("verifies timestamp+body signature and converts rupees to paise", () => {
    vi.stubEnv("CASHFREE_SECRET", "cfsecret");
    const b = JSON.stringify({ data: { link_id: "L1", link_status: "PAID", link_amount_paid: 132.5, cf_link_id: 77 } });
    const ts = "1700000000";
    const sig = createHmac("sha256", "cfsecret").update(ts + b).digest("base64");
    const r = readWebhook("cashfree", b, new Headers({ "x-webhook-signature": sig, "x-webhook-timestamp": ts }));
    expect(r.event).toEqual({ providerOrderId: "L1", providerPaymentId: "77", status: "PAID", amountPaise: 13250 });
    expect(readWebhook("cashfree", b, new Headers({ "x-webhook-signature": "bad", "x-webhook-timestamp": ts })).valid).toBe(false);
  });
});

describe("gatewayMode", () => {
  it("offers test mode only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(gatewayMode()).toBe("test");
    vi.stubEnv("NODE_ENV", "production");
    expect(gatewayMode()).toBeNull();
    vi.stubEnv("PAYMENT_TEST_MODE", "1");
    expect(gatewayMode()).toBe("test");
  });
  it("uses a real gateway only when its keys are set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PAYMENT_PROVIDER", "razorpay");
    expect(gatewayMode()).toBeNull();
    vi.stubEnv("RAZORPAY_KEY_ID", "k");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "s");
    expect(gatewayMode()).toBe("razorpay");
  });
});
