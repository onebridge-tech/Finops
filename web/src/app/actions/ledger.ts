"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { findParty, partyWhere, requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newShareToken } from "@/lib/session";
import { parseRupees } from "@/lib/money";
import { isValidGstin, normalizeGstin, STATES } from "@/lib/gstin";
import { appUrl, normalizeIndianMobile } from "@/lib/share";
import { balanceOf, openByEntry } from "@/lib/ledger";
import { creditGate } from "@/lib/credit-gate";
import { formatINR } from "@/lib/money";
import { snoozeUntil } from "@/lib/rules";
import { proposeShared, withdrawShared } from "@/lib/shared-ledger";
import { fmtDate, PAYMENT_MODES } from "@/lib/format";
import { LANGUAGE_NAMES } from "@/lib/messaging/templates";
import { sendToParty } from "@/lib/messaging/send";
import type { Channel } from "@/lib/reminder-rule";
import { checkUpload, saveUpload } from "@/lib/files";
import { issueReceipt } from "@/lib/receipts";

export type FormState = { error?: string; ok?: boolean; warning?: string[] };

const PartyInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH", "LEAD"]),
  phone: z.string().trim().refine((v) => v === "" || normalizeIndianMobile(v) !== null, "Enter a valid 10-digit mobile number"),
  email: z.string().trim().max(120),
  gstin: z.string().trim().transform(normalizeGstin).refine((v) => v === "" || isValidGstin(v), "GSTIN is not valid"),
  stateCode: z.string().refine((v) => v === "" || v in STATES, "Unknown state"),
  address: z.string().trim().max(300),
  creditDays: z.string().refine((v) => v === "" || /^\d{1,3}$/.test(v), "Credit days must be a number"),
  language: z.string().refine((v) => v in LANGUAGE_NAMES, "Unknown language"),
  source: z.string().trim().max(60),
  opening: z.string().trim(),
  openingDirection: z.enum(["GAVE", "GOT"]),
  creditLimit: z.string().trim().refine((v) => v === "" || parseRupees(v) !== null, "Credit limit must be an amount like 50000"),
  priceListId: z.string(),
});

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

/** A team member id from a form, only if they belong to this business. */
async function validOwner(businessId: string, userId: string): Promise<string | null> {
  if (!userId) return null;
  return (await db.membership.count({ where: { businessId, userId } })) ? userId : null;
}

async function validBranch(businessId: string, branchId: string): Promise<string | null> {
  if (!branchId) return null;
  return (await db.branch.count({ where: { businessId, id: branchId, archivedAt: null } })) ? branchId : null;
}

/** Ledger dates are calendar days: stored as noon IST so ordering ties fall back to createdAt. */
const istNoon = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`);
const todayIstNoon = () => istNoon(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));

export async function createParty(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness("party:write");
  const { user, business } = ctx;
  const r = PartyInput.safeParse(Object.fromEntries(Object.keys(PartyInput.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const opening = d.opening ? parseRupees(d.opening) : 0;
  if (opening === null) return { error: "Opening balance must be an amount like 1500 or 1500.50" };
  const consent = form.get("consent") === "on";
  const owner = await validOwner(business.id, field(form, "ownerId"));

  const party = await db.$transaction(async (tx) => {
    const p = await tx.party.create({
      data: {
        businessId: business.id,
        name: d.name,
        type: d.type,
        phone: d.phone ? normalizeIndianMobile(d.phone) : null,
        email: d.email || null,
        gstin: d.gstin || null,
        stateCode: d.gstin ? d.gstin.slice(0, 2) : d.stateCode || null,
        address: d.address || null,
        creditDays: d.creditDays ? Number(d.creditDays) : null,
        creditLimitPaise: d.creditLimit ? BigInt(parseRupees(d.creditLimit)!) : null,
        priceListId: d.priceListId && (await tx.priceList.count({ where: { id: d.priceListId, businessId: business.id, archivedAt: null } })) ? d.priceListId : null,
        language: d.language,
        source: d.source || null,
        shareToken: newShareToken(),
        consentAt: consent ? new Date() : null,
        // Branch-tied members always create in their branch; others pick one (default: the branch in view).
        branchId: ctx.membership.branchId ?? (form.has("branchId") ? await validBranch(business.id, field(form, "branchId")) : ctx.branchId),
        ownerId: ctx.assignedOnly ? user.id : owner,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "Party", entityId: p.id, data: d });
    if (consent) {
      await tx.consentEvent.create({ data: { businessId: business.id, partyId: p.id, channel: "ALL", action: "GRANTED", source: "BUSINESS_ATTESTED", actorId: user.id } });
    }
    if (opening > 0) {
      const e = await tx.ledgerEntry.create({
        data: {
          businessId: business.id, partyId: p.id, branchId: ctx.branchId, direction: d.openingDirection, amountPaise: BigInt(opening),
          date: todayIstNoon(), note: "Opening balance", source: "OPENING", createdById: user.id,
        },
      });
      await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "LedgerEntry", entityId: e.id, data: e });
    }
    return p;
  });
  redirect(`/parties/${party.id}`);
}

const PartyUpdate = PartyInput.omit({ opening: true, openingDirection: true });

export async function updateParty(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness("party:write");
  const { user, business } = ctx;
  const party = await findParty(ctx, field(form, "partyId"));
  if (!party) return { error: "Party not found" };
  const r = PartyUpdate.safeParse(Object.fromEntries(Object.keys(PartyUpdate.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const data = {
    name: d.name, type: d.type, phone: d.phone ? normalizeIndianMobile(d.phone) : null, email: d.email || null,
    gstin: d.gstin || null, stateCode: d.gstin ? d.gstin.slice(0, 2) : d.stateCode || null, address: d.address || null,
    creditDays: d.creditDays ? Number(d.creditDays) : null, language: d.language, source: d.source || null,
    creditLimitPaise: d.creditLimit ? BigInt(parseRupees(d.creditLimit)!) : null,
    priceListId: d.priceListId && (await db.priceList.count({ where: { id: d.priceListId, businessId: business.id, archivedAt: null } })) ? d.priceListId : null,
    // Reps can't reassign parties; branch-tied members can't move them out of their branch.
    ...(ctx.assignedOnly ? {} : { ownerId: await validOwner(business.id, field(form, "ownerId")) }),
    ...(ctx.membership.branchId ? {} : { branchId: await validBranch(business.id, field(form, "branchId")) }),
  };
  await db.$transaction(async (tx) => {
    await tx.party.update({ where: { id: party.id }, data });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "update", entity: "Party", entityId: party.id, data: { before: party, after: data } });
  });
  redirect(`/parties/${party.id}`);
}

/** Archived parties drop out of lists and reminders; their ledger stays intact. */
export async function archiveParty(form: FormData): Promise<void> {
  const ctx = await requireBusiness("party:write");
  const party = await findParty(ctx, field(form, "partyId"));
  if (!party) return;
  const archive = field(form, "archive") === "1";
  await db.$transaction(async (tx) => {
    await tx.party.update({ where: { id: party.id }, data: { archivedAt: archive ? new Date() : null } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: archive ? "archive" : "restore", entity: "Party", entityId: party.id });
  });
  redirect(archive ? "/parties" : `/parties/${party.id}`);
}

const EntryInput = z.object({
  partyId: z.string().min(1),
  direction: z.enum(["GAVE", "GOT"]),
  amount: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  dueDate: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Bad due date"),
  note: z.string().trim().max(300),
  paymentMode: z.enum(["", ...PAYMENT_MODES]),
});

export async function addEntry(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness("ledger:write");
  const { user, business } = ctx;
  const r = EntryInput.safeParse(Object.fromEntries(Object.keys(EntryInput.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const amount = parseRupees(d.amount);
  if (!amount) return { error: "Enter an amount greater than zero" };
  const notify = form.get("notify") === "on";
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 5) return { error: "At most 5 attachments per entry" };
  for (const f of files) {
    const err = await checkUpload(f, "ATTACHMENT");
    if (err) return { error: `${f.name}: ${err}` };
  }

  const party = await findParty(ctx, d.partyId);
  if (!party) return { error: "Party not found" };

  if (d.direction === "GAVE") {
    const gate = await creditGate(ctx, party, amount, form.get("override") === "1");
    if (gate.error) return { error: gate.error };
    if (gate.warning) return { warning: gate.warning };
  }

  // Receipts can be assigned to specific bills; the rest settles the oldest first (CP-10).
  const assign: { entryId: string; amount: number }[] = [];
  if (d.direction === "GOT" && field(form, "settle") === "BILLS") {
    const [all, existing] = await Promise.all([db.ledgerEntry.findMany({ where: { partyId: party.id } }), db.allocation.findMany({ where: { partyId: party.id } })]);
    const open = openByEntry(all, existing);
    let total = 0;
    for (const [k, v] of form.entries()) {
      if (!k.startsWith("alloc_") || typeof v !== "string" || !v.trim()) continue;
      const id = k.slice(6);
      const amt = parseRupees(v);
      if (amt === null || amt <= 0) return { error: "Bill amounts must be amounts like 500" };
      const left = open.get(id);
      if (left === undefined) return { error: "One of the bills is no longer open" };
      if (amt > left) return { error: `A bill only has ${formatINR(left)} open` };
      assign.push({ entryId: id, amount: amt });
      total += amt;
    }
    if (total > amount) return { error: "The bill amounts add up to more than the payment" };
  }

  const date = istNoon(d.date);
  let dueDate: Date | null = d.dueDate ? new Date(`${d.dueDate}T23:59:59+05:30`) : null;
  if (!dueDate && d.direction === "GAVE" && party.creditDays) {
    dueDate = new Date(date.getTime() + party.creditDays * 86400_000);
  }

  const { entry, receipt } = await db.$transaction(async (tx) => {
    const e = await tx.ledgerEntry.create({
      data: {
        businessId: business.id, partyId: party.id, branchId: ctx.branchId ?? party.branchId, direction: d.direction, amountPaise: BigInt(amount),
        date, dueDate, note: d.note || null, createdById: user.id,
        // Payments out to a supplier carry a mode too, for the cashbook.
        paymentMode: d.direction === "GOT" || party.type === "SUPPLIER" ? d.paymentMode || null : null,
      },
    });
    for (const a of assign) {
      await tx.allocation.create({ data: { businessId: business.id, partyId: party.id, receiptEntryId: e.id, invoiceEntryId: a.entryId, amountPaise: BigInt(a.amount), createdById: user.id } });
    }
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "LedgerEntry", entityId: e.id, data: { ...e, allocations: assign } });
    // Every payment received gets a numbered receipt (CP-11). A "got" entry without a
    // payment mode is goods received from a supplier, not money.
    const rc = e.direction === "GOT" && e.paymentMode ? await issueReceipt(tx, business.id, e) : null;
    return { entry: e, receipt: rc };
  });
  for (const f of files) await saveUpload(f, { businessId: business.id, userId: user.id, kind: "ATTACHMENT", entryId: entry.id });
  await proposeShared(entry.id).catch(() => false); // offer it to the other side if they're on the platform (LG-10)

  // Messages go out after the response so a slow provider never blocks the form.
  const channel = business.reminderChannel as Channel;
  after(async () => {
    const balancePaise = balanceOf(await db.ledgerEntry.findMany({ where: { partyId: party.id } }));
    const date = fmtDate(entry.date);
    if (receipt && business.autoReceipt) {
      await sendToParty({
        business, party, kind: "RECEIPT", channel, userId: user.id, trigger: "AUTO",
        vars: { amountPaise: amount, number: receipt.number, date, balancePaise, link: appUrl(`/r/${receipt.shareToken}`) },
      });
    } else if (notify) {
      await sendToParty({
        business, party, kind: entry.direction === "GAVE" ? "ENTRY_GAVE" : "ENTRY_GOT", channel, userId: user.id, trigger: "AUTO",
        vars: { amountPaise: amount, date, balancePaise, link: appUrl(`/s/${party.shareToken}`) },
      });
    }
  });
  revalidatePath(`/parties/${party.id}`);
  return { ok: true };
}

/** Entries are immutable: "deleting" posts an equal and opposite reversal entry. */
export async function reverseEntry(form: FormData): Promise<void> {
  const ctx = await requireBusiness("ledger:reverse");
  const { user, business } = ctx;
  const id = field(form, "entryId");
  const entry = await db.ledgerEntry.findFirst({ where: { id, businessId: business.id, party: partyWhere(ctx) }, include: { reversedBy: true } });
  if (!entry || entry.reversedBy || entry.reversalOfId || entry.source === "INVOICE") {
    throw new Error("This entry cannot be reversed.");
  }
  await db.$transaction(async (tx) => {
    const rev = await tx.ledgerEntry.create({
      data: {
        businessId: business.id, partyId: entry.partyId, direction: entry.direction === "GAVE" ? "GOT" : "GAVE",
        amountPaise: entry.amountPaise, date: todayIstNoon(), note: `Reversal of entry dated ${entry.date.toISOString().slice(0, 10)}`,
        source: "REVERSAL", reversalOfId: entry.id, branchId: entry.branchId, createdById: user.id,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "reverse", entity: "LedgerEntry", entityId: entry.id, data: { reversalId: rev.id } });
  });
  await withdrawShared(entry.id);
  revalidatePath(`/parties/${entry.partyId}`);
}

/** Records a reminder the user sent from their own WhatsApp (click-to-chat, free). */
export async function logReminder(partyId: string, body: string): Promise<void> {
  const ctx = await requireBusiness("reminder:send");
  const { user, business } = ctx;
  const party = await findParty(ctx, partyId);
  if (!party) return;
  await db.message.create({
    data: {
      businessId: business.id, partyId, kind: "REMINDER", channel: "WHATSAPP_LINK", to: party.phone ?? "",
      template: `reminder_${party.language}`, body, status: "SENT", provider: "link", sentAt: new Date(), createdById: user.id,
    },
  });
  revalidatePath(`/parties/${partyId}`);
}

/** A lead who has started buying becomes a customer (FS-06). */
export async function convertLead(form: FormData): Promise<void> {
  const ctx = await requireBusiness("party:write");
  const party = await findParty(ctx, field(form, "partyId"));
  if (!party || party.type !== "LEAD") return;
  await db.$transaction(async (tx) => {
    await tx.party.update({ where: { id: party.id }, data: { type: "CUSTOMER" } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "convert_lead", entity: "Party", entityId: party.id });
  });
  revalidatePath(`/parties/${party.id}`);
}

const PromiseInput = z.object({
  partyId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the promised date"),
  amount: z.string().trim().refine((v) => v === "" || parseRupees(v) !== null, "Amount must be like 5000"),
  note: z.string().trim().max(200),
});

/**
 * Logs a promise to pay after a call or visit (CP-09): creates a follow-up for
 * the promised day and holds automatic reminders until the day after it.
 */
export async function addPromise(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireBusiness("party:write");
  const r = PromiseInput.safeParse(Object.fromEntries(Object.keys(PromiseInput.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const party = await findParty(ctx, d.partyId);
  if (!party) return { error: "Party not found" };
  const promisedFor = new Date(`${d.date}T12:00:00+05:30`);
  if (promisedFor.getTime() < Date.now() - 86400_000) return { error: "Pick today or a later date" };
  const amount = d.amount ? parseRupees(d.amount) : null;
  await db.$transaction(async (tx) => {
    const fu = await tx.followUp.create({
      data: {
        businessId: ctx.business.id, partyId: party.id, assignedToId: ctx.user.id, dueAt: new Date(`${d.date}T10:00:00+05:30`), source: "PROMISE",
        note: `Promised to pay${amount ? " " + formatINR(amount) : ""} — check it came${d.note ? ": " + d.note : ""}`, createdById: ctx.user.id,
      },
    });
    const p = await tx.promiseToPay.create({
      data: { businessId: ctx.business.id, partyId: party.id, amountPaise: amount === null ? null : BigInt(amount), promisedFor, note: d.note || null, followUpId: fu.id, createdById: ctx.user.id },
    });
    await tx.party.update({ where: { id: party.id }, data: { reminderSnoozeUntil: snoozeUntil(promisedFor) } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "PromiseToPay", entityId: p.id, data: p });
  });
  revalidatePath(`/parties/${party.id}`);
  return { ok: true };
}
