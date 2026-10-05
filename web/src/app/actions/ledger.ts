"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newShareToken } from "@/lib/session";
import { parseRupees } from "@/lib/money";
import { isValidGstin, normalizeGstin, STATES } from "@/lib/gstin";
import { normalizeIndianMobile, REMINDER_LANGUAGES } from "@/lib/share";

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
  language: z.string().refine((v) => v in REMINDER_LANGUAGES, "Unknown language"),
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
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "Party", entityId: p.id, data: d });
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
});

export async function addEntry(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("ledger:write");
  const r = EntryInput.safeParse(Object.fromEntries(Object.keys(EntryInput.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const amount = parseRupees(d.amount);
  if (!amount) return { error: "Enter an amount greater than zero" };

  const party = await db.party.findFirst({ where: { id: d.partyId, businessId: business.id } });
  if (!party) return { error: "Party not found" };

  const date = istNoon(d.date);
  let dueDate: Date | null = d.dueDate ? new Date(`${d.dueDate}T23:59:59+05:30`) : null;
  if (!dueDate && d.direction === "GAVE" && party.creditDays) {
    dueDate = new Date(date.getTime() + party.creditDays * 86400_000);
  }

  await db.$transaction(async (tx) => {
    const e = await tx.ledgerEntry.create({
      data: {
        businessId: business.id, partyId: party.id, direction: d.direction, amountPaise: BigInt(amount),
        date, dueDate, note: d.note || null, createdById: user.id,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "LedgerEntry", entityId: e.id, data: e });
  });
  revalidatePath(`/parties/${party.id}`);
  return { ok: true };
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

/** Records that a reminder was sent (WhatsApp click-to-chat for Phase 1 MVP). */
export async function logReminder(partyId: string, body: string): Promise<void> {
  const { user, business } = await requireBusiness("reminder:send");
  const party = await db.party.findFirst({ where: { id: partyId, businessId: business.id } });
  if (!party) return;
  await db.message.create({
    data: { businessId: business.id, partyId, channel: "WHATSAPP_LINK", template: `reminder_${party.language}`, body, createdById: user.id },
  });
  revalidatePath(`/parties/${partyId}`);
}
