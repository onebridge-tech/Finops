"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newShareToken } from "@/lib/session";
import { parseRupees } from "@/lib/money";
import { computeInvoice, GST_RATES_BP, isInterState } from "@/lib/gst";
import { STATES } from "@/lib/gstin";
import { appUrl } from "@/lib/share";
import { saveUpload } from "@/lib/files";
import { CHANNELS, type Channel } from "@/lib/reminder-rule";
import { sendToParty } from "@/lib/messaging/send";
import { balanceOf } from "@/lib/ledger";

export type FormState = { error?: string; ok?: boolean; info?: string };

const field = (f: FormData, k: string) => String(f.get(k) ?? "");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalYmd = z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v));

// ── Items (CI-01) ────────────────────────────────────────────────────────────

const ItemInput = z.object({
  name: z.string().trim().min(1, "Item name is required").max(120),
  description: z.string().trim().max(500),
  sku: z.string().trim().max(40),
  unit: z.string().trim().min(1, "Unit is required").max(12),
  price: z.string(),
  purchasePrice: z.string(),
  hsn: z.string().trim().refine((v) => v === "" || /^\d{4,8}$/.test(v), "HSN/SAC must be 4–8 digits"),
  taxRateBp: z.coerce.number().refine((v) => GST_RATES_BP.includes(v), "Pick a GST rate"),
  parentId: z.string(),
  variantName: z.string().trim().max(60),
});

async function parseItem(form: FormData, businessId: string) {
  const r = ItemInput.safeParse(Object.fromEntries(Object.keys(ItemInput.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message } as const;
  const d = r.data;
  const price = parseRupees(d.price);
  if (price === null) return { error: "Price must be an amount like 250 or 250.50" } as const;
  const purchase = d.purchasePrice ? parseRupees(d.purchasePrice) : null;
  if (d.purchasePrice && purchase === null) return { error: "Purchase price must be an amount" } as const;
  if (d.parentId) {
    const parent = await db.item.findFirst({ where: { id: d.parentId, businessId, parentId: null } });
    if (!parent) return { error: "Base product not found" } as const;
    if (!d.variantName) return { error: "Give the variant a name, e.g. Red / XL" } as const;
  }
  return {
    data: {
      name: d.name, description: d.description || null, sku: d.sku || null, unit: d.unit, pricePaise: BigInt(price),
      purchasePricePaise: purchase === null ? null : BigInt(purchase), hsn: d.hsn || null, taxRateBp: d.taxRateBp,
      isPublic: form.get("isPublic") === "on", parentId: d.parentId || null, variantName: d.parentId ? d.variantName : null,
    },
  } as const;
}

async function attachImage(form: FormData, businessId: string, userId: string): Promise<{ id?: string; error?: string }> {
  const file = form.get("image");
  if (!(file instanceof File) || file.size === 0) return {};
  const r = await saveUpload(file, { businessId, userId, kind: "ITEM_IMAGE" });
  return r.ok ? { id: r.id } : { error: r.error };
}

export async function createItem(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("item:write");
  const p = await parseItem(form, business.id);
  if ("error" in p) return { error: p.error };
  const img = await attachImage(form, business.id, user.id);
  if (img.error) return { error: img.error };
  await db.$transaction(async (tx) => {
    const item = await tx.item.create({ data: { businessId: business.id, ...p.data, imageFileId: img.id ?? null } });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "Item", entityId: item.id, data: item });
  });
  revalidatePath("/items");
  return { ok: true };
}

export async function updateItem(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("item:write");
  const item = await db.item.findFirst({ where: { id: field(form, "itemId"), businessId: business.id } });
  if (!item) return { error: "Item not found" };
  const p = await parseItem(form, business.id);
  if ("error" in p) return { error: p.error };
  if (p.data.parentId === item.id) return { error: "An item cannot be its own variant" };
  const img = await attachImage(form, business.id, user.id);
  if (img.error) return { error: img.error };
  const data = { ...p.data, ...(img.id ? { imageFileId: img.id } : {}), ...(form.get("removeImage") === "on" ? { imageFileId: null } : {}) };
  await db.$transaction(async (tx) => {
    await tx.item.update({ where: { id: item.id }, data });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "update", entity: "Item", entityId: item.id, data: { before: item, after: data } });
  });
  revalidatePath("/items");
  redirect("/items");
}

export async function archiveItem(form: FormData): Promise<void> {
  const { user, business } = await requireBusiness("item:write");
  const item = await db.item.findFirst({ where: { id: field(form, "itemId"), businessId: business.id } });
  if (!item) return;
  const archive = field(form, "archive") === "1";
  await db.$transaction(async (tx) => {
    await tx.item.updateMany({ where: { OR: [{ id: item.id }, { parentId: item.id }] }, data: { archivedAt: archive ? new Date() : null } });
    await audit(tx, { businessId: business.id, actorId: user.id, action: archive ? "archive" : "restore", entity: "Item", entityId: item.id });
  });
  revalidatePath("/items");
}

// ── Documents: shared line handling for invoices and quotations ──────────────

const DocInput = z.object({
  partyId: z.string().min(1, "Choose a customer"),
  date: ymd,
  dueDate: optionalYmd, // invoice: due date · quotation: valid until
  placeOfSupply: z.string().refine((v) => v in STATES, "Choose the place of supply"),
  notes: z.string().trim().max(500),
  lines: z
    .array(
      z.object({
        itemId: z.string().optional(),
        description: z.string().trim().min(1, "Every line needs a description").max(200),
        hsn: z.string().trim().max(8).optional(),
        unit: z.string().trim().max(12).default("pcs"),
        qty: z.string(),
        rate: z.string(),
        taxRateBp: z.number().refine((v) => GST_RATES_BP.includes(v), "Invalid GST rate"),
      }),
    )
    .min(1, "Add at least one line"),
});

type DocInputT = z.infer<typeof DocInput>;
type ParsedLine = DocInputT["lines"][number] & { qtyMilli: number; ratePaise: number };

function parseDoc(form: FormData): { error: string } | { doc: DocInputT; lines: ParsedLine[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(field(form, "payload"));
  } catch {
    return { error: "Invalid form data" };
  }
  const r = DocInput.safeParse(raw);
  if (!r.success) return { error: r.error.issues[0].message };
  const lines: ParsedLine[] = [];
  for (const [i, l] of r.data.lines.entries()) {
    const qtyMilli = Math.round(Number(l.qty) * 1000);
    const rate = parseRupees(l.rate);
    if (!Number.isFinite(qtyMilli) || qtyMilli <= 0) return { error: `Line ${i + 1}: quantity must be more than zero` };
    if (rate === null) return { error: `Line ${i + 1}: rate must be an amount` };
    lines.push({ ...l, qtyMilli, ratePaise: rate });
  }
  return { doc: r.data, lines };
}

type LineRow = { itemId: string | null; description: string; hsn: string | null; qtyMilli: number; unit: string; ratePaise: number; taxRateBp: number };

/** Totals and per-line rows ready to store on an invoice or quotation. */
function priceLines(lines: LineRow[], interState: boolean) {
  const totals = computeInvoice(lines, interState);
  return {
    header: {
      interState,
      taxablePaise: BigInt(totals.taxable), cgstPaise: BigInt(totals.cgst), sgstPaise: BigInt(totals.sgst),
      igstPaise: BigInt(totals.igst), roundOffPaise: BigInt(totals.roundOff), totalPaise: BigInt(totals.total),
    },
    rows: lines.map((l, i) => ({
      itemId: l.itemId, description: l.description, hsn: l.hsn, qtyMilli: l.qtyMilli, unit: l.unit,
      ratePaise: BigInt(l.ratePaise), taxRateBp: l.taxRateBp,
      taxablePaise: BigInt(totals.lines[i].taxable), cgstPaise: BigInt(totals.lines[i].cgst),
      sgstPaise: BigInt(totals.lines[i].sgst), igstPaise: BigInt(totals.lines[i].igst), totalPaise: BigInt(totals.lines[i].total),
    })),
    total: totals.total,
  };
}

const istNoon = (d: string) => new Date(`${d}T12:00:00+05:30`);
const endOfDay = (d: string) => new Date(`${d}T23:59:59+05:30`);
const toRows = (lines: ParsedLine[]): LineRow[] =>
  lines.map((l) => ({ itemId: l.itemId || null, description: l.description, hsn: l.hsn || null, qtyMilli: l.qtyMilli, unit: l.unit, ratePaise: l.ratePaise, taxRateBp: l.taxRateBp }));

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** Creates an invoice and posts it to the party ledger (PRD flow F1). */
async function issueInvoice(
  tx: Tx,
  o: { businessId: string; userId: string; partyId: string; date: Date; dueDate: Date | null; placeOfSupply: string; notes: string | null; lines: LineRow[]; quoteId?: string },
) {
  const business = await tx.business.update({ where: { id: o.businessId }, data: { nextInvoiceNo: { increment: 1 } } });
  const number = `${business.invoicePrefix}${business.nextInvoiceNo - 1}`;
  const priced = priceLines(o.lines, isInterState(business.stateCode, o.placeOfSupply));
  const inv = await tx.invoice.create({
    data: {
      businessId: o.businessId, partyId: o.partyId, number, date: o.date, dueDate: o.dueDate, placeOfSupply: o.placeOfSupply,
      ...priced.header, notes: o.notes, shareToken: newShareToken(), createdById: o.userId, quoteId: o.quoteId ?? null,
      lines: { create: priced.rows },
    },
  });
  await tx.ledgerEntry.create({
    data: {
      businessId: o.businessId, partyId: o.partyId, direction: "GAVE", amountPaise: priced.header.totalPaise, date: o.date, dueDate: o.dueDate,
      note: `Invoice ${number}`, source: "INVOICE", invoiceId: inv.id, createdById: o.userId,
    },
  });
  await audit(tx, { businessId: o.businessId, actorId: o.userId, action: "create", entity: "Invoice", entityId: inv.id, data: { number, total: priced.total, quoteId: o.quoteId } });
  return inv;
}

export async function createInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("invoice:write");
  const p = parseDoc(form);
  if ("error" in p) return { error: p.error };
  const party = await db.party.findFirst({ where: { id: p.doc.partyId, businessId: business.id } });
  if (!party) return { error: "Customer not found" };
  const date = istNoon(p.doc.date);
  const dueDate = p.doc.dueDate ? endOfDay(p.doc.dueDate) : party.creditDays ? new Date(date.getTime() + party.creditDays * 86400_000) : null;
  const invoice = await db.$transaction((tx) =>
    issueInvoice(tx, { businessId: business.id, userId: user.id, partyId: party.id, date, dueDate, placeOfSupply: p.doc.placeOfSupply, notes: p.doc.notes || null, lines: toRows(p.lines) }),
  );
  redirect(`/invoices/${invoice.id}`);
}

/**
 * Cancels an invoice and reverses its ledger entry. GST rules allow this only
 * before the invoice is reported in GSTR-1; after that, issue a credit note.
 */
export async function cancelInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("invoice:cancel");
  const reason = field(form, "reason").trim();
  if (reason.length < 3) return { error: "Give a reason for cancelling" };
  const invoice = await db.invoice.findFirst({ where: { id: field(form, "invoiceId"), businessId: business.id } });
  if (!invoice || invoice.status === "CANCELLED") return { error: "Invoice not found or already cancelled" };
  const posted = await db.ledgerEntry.findFirst({ where: { invoiceId: invoice.id, source: "INVOICE" }, include: { reversedBy: true } });
  await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason } });
    if (posted && !posted.reversedBy) {
      await tx.ledgerEntry.create({
        data: {
          businessId: business.id, partyId: invoice.partyId, direction: "GOT", amountPaise: posted.amountPaise,
          date: new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T12:00:00+05:30`),
          note: `Invoice ${invoice.number} cancelled`, source: "REVERSAL", reversalOfId: posted.id, invoiceId: invoice.id, createdById: user.id,
        },
      });
    }
    await audit(tx, { businessId: business.id, actorId: user.id, action: "cancel", entity: "Invoice", entityId: invoice.id, data: { reason } });
  });
  revalidatePath(`/invoices/${invoice.id}`);
  return { ok: true };
}

// ── Quotations (BD-01) ───────────────────────────────────────────────────────

export async function createQuote(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("invoice:write");
  const p = parseDoc(form);
  if ("error" in p) return { error: p.error };
  const party = await db.party.findFirst({ where: { id: p.doc.partyId, businessId: business.id } });
  if (!party) return { error: "Customer not found" };
  const quote = await db.$transaction(async (tx) => {
    const b = await tx.business.update({ where: { id: business.id }, data: { nextQuoteNo: { increment: 1 } } });
    const number = `${b.quotePrefix}${b.nextQuoteNo - 1}`;
    const priced = priceLines(toRows(p.lines), isInterState(business.stateCode, p.doc.placeOfSupply));
    const q = await tx.quote.create({
      data: {
        businessId: business.id, partyId: party.id, number, date: istNoon(p.doc.date),
        validUntil: p.doc.dueDate ? endOfDay(p.doc.dueDate) : null, placeOfSupply: p.doc.placeOfSupply,
        ...priced.header, notes: p.doc.notes || null, shareToken: newShareToken(), createdById: user.id,
        lines: { create: priced.rows },
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "Quote", entityId: q.id, data: { number, total: priced.total } });
    return q;
  });
  redirect(`/quotes/${quote.id}`);
}

/** One tap: the quotation becomes an invoice dated today with the same lines. */
export async function convertQuote(form: FormData): Promise<void> {
  const { user, business } = await requireBusiness("invoice:write");
  const quote = await db.quote.findFirst({ where: { id: field(form, "quoteId"), businessId: business.id }, include: { lines: true, party: true } });
  if (!quote || quote.status === "CONVERTED" || quote.status === "DECLINED") throw new Error("This quotation can't be converted.");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const date = istNoon(today);
  const dueDate = quote.party.creditDays ? new Date(date.getTime() + quote.party.creditDays * 86400_000) : null;
  const invoice = await db.$transaction(async (tx) => {
    const inv = await issueInvoice(tx, {
      businessId: business.id, userId: user.id, partyId: quote.partyId, date, dueDate, placeOfSupply: quote.placeOfSupply,
      notes: quote.notes, quoteId: quote.id,
      lines: quote.lines.map((l) => ({ itemId: l.itemId, description: l.description, hsn: l.hsn, qtyMilli: l.qtyMilli, unit: l.unit, ratePaise: Number(l.ratePaise), taxRateBp: l.taxRateBp })),
    });
    await tx.quote.update({ where: { id: quote.id }, data: { status: "CONVERTED", convertedInvoiceId: inv.id } });
    return inv;
  });
  redirect(`/invoices/${invoice.id}`);
}

export async function setQuoteStatus(form: FormData): Promise<void> {
  const { user, business } = await requireBusiness("invoice:write");
  const status = field(form, "status");
  if (!["OPEN", "ACCEPTED", "DECLINED"].includes(status)) return;
  const quote = await db.quote.findFirst({ where: { id: field(form, "quoteId"), businessId: business.id } });
  if (!quote || quote.status === "CONVERTED") return;
  await db.$transaction(async (tx) => {
    await tx.quote.update({ where: { id: quote.id }, data: { status, respondedAt: status === "OPEN" ? null : new Date() } });
    await audit(tx, { businessId: business.id, actorId: user.id, action: `mark_${status.toLowerCase()}`, entity: "Quote", entityId: quote.id });
  });
  revalidatePath(`/quotes/${quote.id}`);
}

/** The customer accepts or declines from the public quotation page (no login). */
export async function respondToQuote(_prev: FormState, form: FormData): Promise<FormState> {
  const quote = await db.quote.findUnique({ where: { shareToken: field(form, "token") } });
  if (!quote || quote.status !== "OPEN") return { error: "This quotation is no longer open." };
  if (quote.validUntil && quote.validUntil < new Date()) return { error: "This quotation has expired. Please ask for a fresh one." };
  const accept = field(form, "response") === "accept";
  const name = field(form, "name").trim().slice(0, 80);
  if (accept && name.length < 2) return { error: "Type your name to accept" };
  await db.quote.update({
    where: { id: quote.id },
    data: { status: accept ? "ACCEPTED" : "DECLINED", respondedAt: new Date(), responderName: name || null },
  });
  revalidatePath(`/q/${quote.shareToken}`);
  return { ok: true };
}

// ── Sharing (BD-05) ──────────────────────────────────────────────────────────

export async function sendDocument(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("reminder:send");
  const channel = field(form, "channel") as Channel;
  if (!CHANNELS.includes(channel)) return { error: "Choose how to send" };
  const id = field(form, "id");
  const isQuote = field(form, "kind") === "QUOTE";
  const doc = isQuote
    ? await db.quote.findFirst({ where: { id, businessId: business.id }, include: { party: true } })
    : await db.invoice.findFirst({ where: { id, businessId: business.id }, include: { party: true } });
  if (!doc) return { error: "Document not found" };
  if (doc.status === "CANCELLED") return { error: "This invoice is cancelled" };
  const balancePaise = balanceOf(await db.ledgerEntry.findMany({ where: { partyId: doc.partyId } }));
  const r = await sendToParty({
    business, party: doc.party, kind: isQuote ? "QUOTE" : "INVOICE", channel, userId: user.id,
    vars: { number: doc.number, amountPaise: Number(doc.totalPaise), balancePaise, link: appUrl(`/${isQuote ? "q" : "i"}/${doc.shareToken}`) },
  });
  revalidatePath(`/${isQuote ? "quotes" : "invoices"}/${doc.id}`);
  return r.ok ? { ok: true, info: "Sent" } : { error: r.error };
}
