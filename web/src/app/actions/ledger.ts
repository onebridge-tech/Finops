"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newShareToken } from "@/lib/session";
import { parseRupees } from "@/lib/money";
import { isValidGstin, normalizeGstin, STATES } from "@/lib/gstin";
import { appUrl, normalizeIndianMobile } from "@/lib/share";
import { balanceOf } from "@/lib/ledger";
import { fmtDate, PAYMENT_MODES } from "@/lib/format";
import { LANGUAGE_NAMES } from "@/lib/messaging/templates";
import { sendToParty } from "@/lib/messaging/send";
import type { Channel } from "@/lib/reminder-rule";
import { checkUpload, saveUpload } from "@/lib/files";

export type FormState = { error?: string; ok?: boolean };

const PartyInput = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
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
});

const field = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Ledger dates are calendar days: stored as noon IST so ordering ties fall back to createdAt. */
const istNoon = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`);
const todayIstNoon = () => istNoon(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));

export async function createParty(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("party:write");
  const r = PartyInput.safeParse(Object.fromEntries(Object.keys(PartyInput.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const opening = d.opening ? parseRupees(d.opening) : 0;
  if (opening === null) return { error: "Opening balance must be an amount like 1500 or 1500.50" };
  const consent = form.get("consent") === "on";

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
        language: d.language,
        source: d.source || null,
        shareToken: newShareToken(),
        consentAt: consent ? new Date() : null,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "Party", entityId: p.id, data: d });
    if (consent) {
      await tx.consentEvent.create({ data: { businessId: business.id, partyId: p.id, channel: "ALL", action: "GRANTED", source: "BUSINESS_ATTESTED", actorId: user.id } });
    }
    if (opening > 0) {
      const e = await tx.ledgerEntry.create({
        data: {
          businessId: business.id, partyId: p.id, direction: d.openingDirection, amountPaise: BigInt(opening),
          date: todayIstNoon(), note: "Opening balance", source: "OPENING", createdById: user.id,
        },
      });
      await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "LedgerEntry", entityId: e.id, data: e });
    }
    return p;
  });
  redirect(`/parties/${party.id}`);
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
  const { user, business } = await requireBusiness("ledger:write");
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

  const party = await db.party.findFirst({ where: { id: d.partyId, businessId: business.id } });
  if (!party) return { error: "Party not found" };

  const date = istNoon(d.date);
  let dueDate: Date | null = d.dueDate ? new Date(`${d.dueDate}T23:59:59+05:30`) : null;
  if (!dueDate && d.direction === "GAVE" && party.creditDays) {
    dueDate = new Date(date.getTime() + party.creditDays * 86400_000);
  }

  const { entry, receipt } = await db.$transaction(async (tx) => {
    const e = await tx.ledgerEntry.create({
      data: {
        businessId: business.id, partyId: party.id, direction: d.direction, amountPaise: BigInt(amount),
        date, dueDate, note: d.note || null, createdById: user.id,
        paymentMode: d.direction === "GOT" ? d.paymentMode || null : null,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "LedgerEntry", entityId: e.id, data: e });
    // Every payment received gets a numbered receipt (CP-11). A "got" entry without a
    // payment mode is goods received from a supplier, not money.
    const rc = e.direction === "GOT" && e.paymentMode ? await issueReceipt(tx, business.id, e) : null;
    return { entry: e, receipt: rc };
  });
  for (const f of files) await saveUpload(f, { businessId: business.id, userId: user.id, kind: "ATTACHMENT", entryId: entry.id });

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

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Reserves the next receipt number and issues a receipt for a money-in entry. */
async function issueReceipt(tx: Tx, businessId: string, e: { id: string; partyId: string; amountPaise: bigint; date: Date; paymentMode: string | null }) {
  const b = await tx.business.update({ where: { id: businessId }, data: { nextReceiptNo: { increment: 1 } } });
  return tx.receipt.create({
    data: {
      businessId, partyId: e.partyId, entryId: e.id, number: `${b.receiptPrefix}${b.nextReceiptNo - 1}`,
      amountPaise: e.amountPaise, date: e.date, mode: e.paymentMode, shareToken: newShareToken(),
    },
  });
}

/** Entries are immutable: "deleting" posts an equal and opposite reversal entry. */
export async function reverseEntry(form: FormData): Promise<void> {
  const { user, business } = await requireBusiness("ledger:reverse");
  const id = field(form, "entryId");
  const entry = await db.ledgerEntry.findFirst({ where: { id, businessId: business.id }, include: { reversedBy: true } });
  if (!entry || entry.reversedBy || entry.reversalOfId || entry.source === "INVOICE") {
    throw new Error("This entry cannot be reversed.");
  }
  await db.$transaction(async (tx) => {
    const rev = await tx.ledgerEntry.create({
      data: {
        businessId: business.id, partyId: entry.partyId, direction: entry.direction === "GAVE" ? "GOT" : "GAVE",
        amountPaise: entry.amountPaise, date: todayIstNoon(), note: `Reversal of entry dated ${entry.date.toISOString().slice(0, 10)}`,
        source: "REVERSAL", reversalOfId: entry.id, createdById: user.id,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "reverse", entity: "LedgerEntry", entityId: entry.id, data: { reversalId: rev.id } });
  });
  revalidatePath(`/parties/${entry.partyId}`);
}

/** Records a reminder the user sent from their own WhatsApp (click-to-chat, free). */
export async function logReminder(partyId: string, body: string): Promise<void> {
  const { user, business } = await requireBusiness("reminder:send");
  const party = await db.party.findFirst({ where: { id: partyId, businessId: business.id } });
  if (!party) return;
  await db.message.create({
    data: {
      businessId: business.id, partyId, kind: "REMINDER", channel: "WHATSAPP_LINK", to: party.phone ?? "",
      template: `reminder_${party.language}`, body, status: "SENT", provider: "link", sentAt: new Date(), createdById: user.id,
    },
  });
  revalidatePath(`/parties/${partyId}`);
}
