"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { findParty, partyWhere, requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { balanceOf } from "@/lib/ledger";
import { appUrl } from "@/lib/share";
import { CHANNELS, type Channel } from "@/lib/reminder-rule";
import { CREDIT_PACKS } from "@/lib/credits";
import { recordConsent, recordOptIn, recordOptOut } from "@/lib/consent";
import { sendToParty } from "@/lib/messaging/send";
import { runAutoReminders } from "@/lib/reminders";
import { runDigests, runInactiveScan } from "@/lib/jobs";
import { inviteUrl } from "@/lib/referral";
import { formatINR } from "@/lib/money";

export type MessageState = { error?: string; ok?: boolean; info?: string };

const field = (f: FormData, k: string) => String(f.get(k) ?? "");
const channelOf = (v: string): Channel | null => (CHANNELS.includes(v as Channel) ? (v as Channel) : null);

/** One-tap reminder or statement share through the WhatsApp API, SMS or email (CP-01). */
export async function sendPartyMessage(_prev: MessageState, form: FormData): Promise<MessageState> {
  const ctx = await requireBusiness("reminder:send");
  const { user, business } = ctx;
  const channel = channelOf(field(form, "channel"));
  const k = field(form, "kind");
  const kind = k === "STATEMENT" || k === "INVITE" ? k : "REMINDER";
  if (!channel) return { error: "Choose how to send" };
  const party = await findParty(ctx, field(form, "partyId"));
  if (!party) return { error: "Party not found" };
  const balance = balanceOf(await db.ledgerEntry.findMany({ where: { partyId: party.id } }));
  if (kind === "REMINDER" && balance <= 0) return { error: "Nothing is due from this party" };

  const r = await sendToParty({
    business, party, kind, channel, userId: user.id,
    vars: { balancePaise: balance, link: kind === "INVITE" ? await inviteUrl(business.id) : appUrl(`/s/${party.shareToken}`) },
  });
  revalidatePath(`/parties/${party.id}`);
  return r.ok ? { ok: true, info: "Sent" } : { error: r.error };
}

/** Reminders to many parties at once (CP-03). */
export async function sendBulkReminders(_prev: MessageState, form: FormData): Promise<MessageState> {
  const ctx = await requireBusiness("reminder:send");
  const { user, business } = ctx;
  const channel = channelOf(field(form, "channel"));
  if (!channel) return { error: "Choose how to send" };
  const ids = form.getAll("partyId").map(String);
  if (ids.length === 0) return { error: "Select at least one party" };
  if (ids.length > 500) return { error: "Send to at most 500 parties at a time" };

  const parties = await db.party.findMany({ where: { ...partyWhere(ctx), id: { in: ids } } });
  let sent = 0, skipped = 0, failed = 0;
  for (const party of parties) {
    const balance = balanceOf(await db.ledgerEntry.findMany({ where: { partyId: party.id } }));
    if (balance <= 0) { skipped++; continue; }
    const r = await sendToParty({
      business, party, kind: "REMINDER", channel, trigger: "BULK", userId: user.id,
      vars: { balancePaise: balance, link: appUrl(`/s/${party.shareToken}`) },
    });
    if (r.ok) sent++; else if (r.status === "SKIPPED") skipped++; else failed++;
  }
  revalidatePath("/collections");
  return { ok: true, info: `Sent ${sent}` + (skipped ? ` · skipped ${skipped}` : "") + (failed ? ` · failed ${failed}` : "") };
}

/** The business records that a party agreed to messages, or relays an opt-out/opt-in request. */
export async function updateConsent(form: FormData): Promise<void> {
  const ctx = await requireBusiness("party:write");
  const { user } = ctx;
  const party = await findParty(ctx, field(form, "partyId"));
  if (!party) return;
  const action = field(form, "action");
  const channel = field(form, "channel") === "ALL" ? "ALL" : channelOf(field(form, "channel"));
  if (action === "grant") await recordConsent(party, user.id);
  else if (channel && action === "optout") await recordOptOut(party, channel, "BUSINESS_ATTESTED", user.id);
  else if (channel && action === "optin") await recordOptIn(party, channel, "BUSINESS_ATTESTED", user.id);
  revalidatePath(`/parties/${party.id}`);
}

/** A disputed account gets no automatic reminders until resolved. */
export async function setDisputed(form: FormData): Promise<void> {
  const ctx = await requireBusiness("party:write");
  const { user, business } = ctx;
  const party = await findParty(ctx, field(form, "partyId"));
  if (!party) return;
  const disputed = field(form, "disputed") === "1";
  await db.$transaction(async (tx) => {
    await tx.party.update({ where: { id: party.id }, data: { disputedAt: disputed ? new Date() : null } });
    await audit(tx, { businessId: business.id, actorId: user.id, action: disputed ? "dispute" : "resolve", entity: "Party", entityId: party.id });
  });
  revalidatePath(`/parties/${party.id}`);
}

const optionalDays = z.string().refine((v) => v === "" || /^\d{1,3}$/.test(v), "Days must be a number").transform((v) => (v === "" ? null : Number(v)));

const RuleInput = z.object({
  daysBefore: optionalDays,
  onDue: z.boolean(),
  everyDaysAfter: optionalDays,
  channel: z.enum(["WHATSAPP", "SMS", "EMAIL"]),
});

function parseRule(form: FormData) {
  return RuleInput.safeParse({
    daysBefore: field(form, "daysBefore"), onDue: form.get("onDue") === "on",
    everyDaysAfter: field(form, "everyDaysAfter"), channel: field(form, "channel"),
  });
}

export async function updatePartyReminders(_prev: MessageState, form: FormData): Promise<MessageState> {
  const ctx = await requireBusiness("party:write");
  const { user, business } = ctx;
  const party = await findParty(ctx, field(form, "partyId"));
  if (!party) return { error: "Party not found" };
  const mode = field(form, "mode");
  if (!["DEFAULT", "CUSTOM", "OFF"].includes(mode)) return { error: "Choose a reminder setting" };
  const r = parseRule(form);
  if (mode === "CUSTOM" && !r.success) return { error: r.error.issues[0].message };
  const data = mode === "CUSTOM" && r.success
    ? { reminderMode: mode, reminderDaysBefore: r.data.daysBefore, reminderOnDue: r.data.onDue, reminderEveryDaysAfter: r.data.everyDaysAfter, reminderChannel: r.data.channel }
    : { reminderMode: mode };
  await db.$transaction(async (tx) => {
    await tx.party.update({ where: { id: party.id }, data });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "update", entity: "Party", entityId: party.id, data });
  });
  revalidatePath(`/parties/${party.id}`);
  return { ok: true, info: "Saved" };
}

export async function updateMessagingSettings(_prev: MessageState, form: FormData): Promise<MessageState> {
  const ctx = await requireBusiness("settings:write");
  const { user, business } = ctx;
  const r = parseRule(form);
  if (!r.success) return { error: r.error.issues[0].message };
  const data = {
    reminderEnabled: form.get("reminderEnabled") === "on",
    reminderDaysBefore: r.data.daysBefore, reminderOnDue: r.data.onDue, reminderEveryDaysAfter: r.data.everyDaysAfter, reminderChannel: r.data.channel,
    autoReceipt: form.get("autoReceipt") === "on",
    entryConfirm: form.get("entryConfirm") === "on",
  };
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: business.id }, data });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "update", entity: "Business", entityId: business.id, data });
  });
  revalidatePath("/settings");
  return { ok: true, info: "Saved" };
}

export async function runRemindersNow(): Promise<MessageState> {
  const ctx = await requireBusiness("settings:write");
  const { business } = ctx;
  const s = await runAutoReminders({ businessId: business.id, ignoreHours: true });
  const d = business.digestFrequency === "OFF" ? null : await runDigests(new Date(), { force: true, businessId: business.id });
  const t = await runInactiveScan(new Date(), business.id);
  revalidatePath("/settings");
  return { ok: true, info: `Reminders: checked ${s.checked}, sent ${s.sent}, skipped ${s.skipped}, failed ${s.failed}. ${d ? `Digest sent to ${d.digests} owner(s). ` : ""}New tasks: ${t.inactive} inactive, ${t.upsell} upsell.` };
}

/**
 * Buying credits needs the payment gateway (CP-05). Until one is configured the
 * app runs in test mode and adds the pack straight away, marked as a test top-up.
 */
export async function buyCredits(_prev: MessageState, form: FormData): Promise<MessageState> {
  const ctx = await requireBusiness("settings:write");
  const { user, business } = ctx;
  const pack = CREDIT_PACKS.find((p) => p.id === field(form, "pack"));
  if (!pack) return { error: "Choose a credit pack" };
  if (process.env.PAYMENT_PROVIDER) return { error: "Online payment for credits is not wired up yet." };
  await db.$transaction(async (tx) => {
    const b = await tx.business.update({ where: { id: business.id }, data: { creditBalance: { increment: pack.credits } } });
    await tx.creditTxn.create({
      data: { businessId: business.id, delta: pack.credits, balanceAfter: b.creditBalance, reason: "TOPUP", userId: user.id, note: `Test top-up (${formatINR(pack.pricePaise)} pack, no payment taken)` },
    });
  });
  revalidatePath("/settings/credits");
  return { ok: true, info: `Added ${pack.credits} credits (test mode)` };
}

/** Public opt-out / opt-in from the link at the end of every message (no login). */
export async function publicConsent(form: FormData): Promise<void> {
  const party = await db.party.findUnique({ where: { shareToken: field(form, "token") } });
  if (!party) return;
  const channel = field(form, "channel") === "ALL" ? "ALL" : channelOf(field(form, "channel"));
  if (!channel) return;
  if (field(form, "action") === "in") await recordOptIn(party, channel, "PUBLIC_LINK");
  else await recordOptOut(party, channel, "PUBLIC_LINK");
  revalidatePath(`/o/${party.shareToken}`);
}
