import "server-only";
import type { Business, Party } from "@prisma/client";
import { db } from "../db";
import { CREDIT_COST } from "../credits";
import { appUrl, normalizeIndianMobile } from "../share";
import type { Channel } from "../reminder-rule";
import { deliver, providerName } from "./providers";
import { renderMessage, templateParams, type MessageKind, type TemplateVars } from "./templates";

const COARSE_KIND: Record<MessageKind, string> = {
  REMINDER: "REMINDER", ENTRY_GAVE: "ENTRY_CONFIRMATION", ENTRY_GOT: "ENTRY_CONFIRMATION", RECEIPT: "RECEIPT",
  INVOICE: "INVOICE", QUOTE: "QUOTE", STATEMENT: "STATEMENT", INVITE: "INVITE",
};

const SUBJECT: Record<MessageKind, string> = {
  REMINDER: "Payment reminder", ENTRY_GAVE: "New entry in your account", ENTRY_GOT: "Payment recorded", RECEIPT: "Payment receipt",
  INVOICE: "Invoice", QUOTE: "Quotation", STATEMENT: "Account statement", INVITE: "Your account",
};

export type SendOptions = {
  business: Pick<Business, "id" | "name">;
  party: Party;
  kind: MessageKind;
  channel: Channel;
  vars: Omit<TemplateVars, "party" | "business">;
  trigger?: "MANUAL" | "AUTO" | "BULK";
  userId?: string | null;
};

export type SendOutcome = { ok: boolean; status: string; error?: string; messageId?: string };

/** Why this party can't be messaged on this channel right now, or null. */
export function blockedReason(party: Party, channel: Channel): string | null {
  if (channel === "EMAIL" ? !party.email : !party.phone || !normalizeIndianMobile(party.phone)) {
    return channel === "EMAIL" ? "No email address" : "No mobile number";
  }
  if (!party.consentAt) return "No messaging consent recorded";
  const optedOut = { WHATSAPP: party.whatsappOptOutAt, SMS: party.smsOptOutAt, EMAIL: party.emailOptOutAt }[channel];
  if (optedOut) return `Opted out of ${channel === "EMAIL" ? "email" : channel === "SMS" ? "SMS" : "WhatsApp"}`;
  return null;
}

/**
 * Sends one message to a party: checks consent and opt-outs, charges credits,
 * calls the channel's provider, and records the outcome. Credits are refunded
 * if the provider rejects the message.
 */
export async function sendToParty(o: SendOptions): Promise<SendOutcome> {
  const { business, party, kind, channel } = o;
  const vars: TemplateVars = { party: party.name, business: business.name, ...o.vars };
  const body = renderMessage(kind, party.language, vars, appUrl(`/o/${party.shareToken}`));
  const to = channel === "EMAIL" ? (party.email ?? "") : (normalizeIndianMobile(party.phone ?? "") ?? "");
  const base = {
    businessId: business.id, partyId: party.id, kind: COARSE_KIND[kind], channel, to,
    template: `${kind.toLowerCase()}_${party.language}`, body, trigger: o.trigger ?? "MANUAL", createdById: o.userId ?? null,
  };

  const blocked = blockedReason(party, channel);
  if (blocked) {
    const m = await db.message.create({ data: { ...base, status: "SKIPPED", provider: providerName(channel), error: blocked } });
    return { ok: false, status: "SKIPPED", error: blocked, messageId: m.id };
  }

  const cost = CREDIT_COST[channel];
  const message = await db.$transaction(async (tx) => {
    if (cost > 0) {
      const debited = await tx.business.updateMany({ where: { id: business.id, creditBalance: { gte: cost } }, data: { creditBalance: { decrement: cost } } });
      if (debited.count === 0) return null;
    }
    const m = await tx.message.create({ data: { ...base, status: "QUEUED", provider: providerName(channel), credits: cost } });
    if (cost > 0) {
      const b = await tx.business.findUniqueOrThrow({ where: { id: business.id }, select: { creditBalance: true } });
      await tx.creditTxn.create({ data: { businessId: business.id, delta: -cost, balanceAfter: b.creditBalance, reason: "MESSAGE", messageId: m.id, userId: o.userId ?? null } });
    }
    return m;
  });
  if (!message) {
    const m = await db.message.create({ data: { ...base, status: "FAILED", provider: providerName(channel), error: "Not enough messaging credits" } });
    return { ok: false, status: "FAILED", error: "Not enough messaging credits", messageId: m.id };
  }

  const r = await deliver({ channel, to, body, subject: `${SUBJECT[kind]} · ${business.name}`, kind, lang: party.language, params: templateParams(kind, vars) });
  const now = new Date();
  if (r.ok) {
    await db.message.update({
      where: { id: message.id },
      data: { status: r.status, provider: r.provider, providerMessageId: r.id, sentAt: now, deliveredAt: r.status === "DELIVERED" ? now : null },
    });
    return { ok: true, status: r.status, messageId: message.id };
  }

  await db.$transaction(async (tx) => {
    await tx.message.update({ where: { id: message.id }, data: { status: "FAILED", provider: r.provider, error: r.error.slice(0, 500) } });
    if (cost > 0) {
      const b = await tx.business.update({ where: { id: business.id }, data: { creditBalance: { increment: cost } } });
      await tx.creditTxn.create({ data: { businessId: business.id, delta: cost, balanceAfter: b.creditBalance, reason: "REFUND", messageId: message.id } });
    }
  });
  return { ok: false, status: "FAILED", error: r.error, messageId: message.id };
}

const STATUS_RANK: Record<string, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };

/** Applies a delivery receipt from a provider webhook. Never moves a status backwards. */
export async function applyDeliveryStatus(providerMessageId: string, status: "SENT" | "DELIVERED" | "READ" | "FAILED", at: Date, error?: string) {
  const m = await db.message.findFirst({ where: { providerMessageId } });
  if (!m || (STATUS_RANK[status] ?? 0) <= (STATUS_RANK[m.status] ?? 0)) return;
  await db.message.update({
    where: { id: m.id },
    data: {
      status,
      ...(status === "DELIVERED" ? { deliveredAt: at } : {}),
      ...(status === "READ" ? { readAt: at, deliveredAt: m.deliveredAt ?? at } : {}),
      ...(status === "FAILED" ? { error: error ?? "Delivery failed" } : {}),
    },
  });
}

export type OwnerMessage = {
  business: Pick<Business, "id" | "name" | "email">;
  to: { phone?: string | null; email?: string | null };
  channel: Channel;
  kind: "DIGEST" | "ALERT";
  subject: string;
  body: string;
  userId?: string | null;
};

/**
 * Messages the business's own people (owner digest, low-stock alert). No party
 * consent is involved, but credits are charged for WhatsApp/SMS like any other
 * message, and a failed send is refunded and recorded.
 */
export async function sendToOwner(o: OwnerMessage): Promise<SendOutcome> {
  const { business, channel } = o;
  const to = channel === "EMAIL" ? (o.to.email ?? "") : (normalizeIndianMobile(o.to.phone ?? "") ?? "");
  const base = { businessId: business.id, partyId: null, kind: o.kind, channel, to, template: o.kind.toLowerCase(), body: o.body, trigger: "AUTO", createdById: o.userId ?? null };
  if (!to) {
    const m = await db.message.create({ data: { ...base, status: "SKIPPED", provider: providerName(channel), error: channel === "EMAIL" ? "No email address" : "No mobile number" } });
    return { ok: false, status: "SKIPPED", error: "No address to send to", messageId: m.id };
  }
  const cost = CREDIT_COST[channel];
  const message = await db.$transaction(async (tx) => {
    if (cost > 0) {
      const debited = await tx.business.updateMany({ where: { id: business.id, creditBalance: { gte: cost } }, data: { creditBalance: { decrement: cost } } });
      if (debited.count === 0) return null;
    }
    const m = await tx.message.create({ data: { ...base, status: "QUEUED", provider: providerName(channel), credits: cost } });
    if (cost > 0) {
      const b = await tx.business.findUniqueOrThrow({ where: { id: business.id }, select: { creditBalance: true } });
      await tx.creditTxn.create({ data: { businessId: business.id, delta: -cost, balanceAfter: b.creditBalance, reason: "MESSAGE", messageId: m.id } });
    }
    return m;
  });
  if (!message) {
    const m = await db.message.create({ data: { ...base, status: "FAILED", provider: providerName(channel), error: "Not enough messaging credits" } });
    return { ok: false, status: "FAILED", error: "Not enough messaging credits", messageId: m.id };
  }
  const r = await deliver({ channel, to, body: o.body, subject: o.subject, kind: o.kind, lang: "en", params: [o.body] });
  const now = new Date();
  if (r.ok) {
    await db.message.update({ where: { id: message.id }, data: { status: r.status, provider: r.provider, providerMessageId: r.id, sentAt: now, deliveredAt: r.status === "DELIVERED" ? now : null } });
    return { ok: true, status: r.status, messageId: message.id };
  }
  await db.$transaction(async (tx) => {
    await tx.message.update({ where: { id: message.id }, data: { status: "FAILED", provider: r.provider, error: r.error.slice(0, 500) } });
    if (cost > 0) {
      const b = await tx.business.update({ where: { id: business.id }, data: { creditBalance: { increment: cost } } });
      await tx.creditTxn.create({ data: { businessId: business.id, delta: cost, balanceAfter: b.creditBalance, reason: "REFUND", messageId: message.id } });
    }
  });
  return { ok: false, status: "FAILED", error: r.error, messageId: message.id };
}
