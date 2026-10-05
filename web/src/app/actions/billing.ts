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

export type FormState = { error?: string; ok?: boolean };

const ItemInput = z.object({
  name: z.string().trim().min(1, "Item name is required").max(120),
  sku: z.string().trim().max(40),
  unit: z.string().trim().min(1).max(12),
  price: z.string(),
  hsn: z.string().trim().refine((v) => v === "" || /^\d{4,8}$/.test(v), "HSN/SAC must be 4–8 digits"),
  taxRateBp: z.coerce.number().refine((v) => GST_RATES_BP.includes(v), "Pick a GST rate"),
});

export async function createItem(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("item:write");
  const r = ItemInput.safeParse(Object.fromEntries(Object.keys(ItemInput.shape).map((k) => [k, String(form.get(k) ?? "")])));
  if (!r.success) return { error: r.error.issues[0].message };
  const price = parseRupees(r.data.price);
  if (price === null) return { error: "Price must be an amount like 250 or 250.50" };
  await db.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: {
        businessId: business.id, name: r.data.name, sku: r.data.sku || null, unit: r.data.unit,
        pricePaise: BigInt(price), hsn: r.data.hsn || null, taxRateBp: r.data.taxRateBp,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "Item", entityId: item.id, data: item });
  });
  revalidatePath("/items");
  return { ok: true };
}

const InvoiceInput = z.object({
  partyId: z.string().min(1, "Choose a customer"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v)),
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

export async function createInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const { user, business } = await requireBusiness("invoice:write");
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return { error: "Invalid form data" };
  }
  const r = InvoiceInput.safeParse(raw);
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;

  const party = await db.party.findFirst({ where: { id: d.partyId, businessId: business.id } });
  if (!party) return { error: "Customer not found" };

  const lines: ((typeof d.lines)[number] & { qtyMilli: number; ratePaise: number })[] = [];
  for (const [i, l] of d.lines.entries()) {
    const qtyMilli = Math.round(Number(l.qty) * 1000);
    const rate = parseRupees(l.rate);
    if (!Number.isFinite(qtyMilli) || qtyMilli <= 0) return { error: `Line ${i + 1}: quantity must be more than zero` };
    if (rate === null) return { error: `Line ${i + 1}: rate must be an amount` };
    lines.push({ ...l, qtyMilli, ratePaise: rate });
  }

  const interState = isInterState(business.stateCode, d.placeOfSupply);
  const totals = computeInvoice(lines, interState);
  const date = new Date(`${d.date}T12:00:00+05:30`);
  const dueDate = d.dueDate
    ? new Date(`${d.dueDate}T23:59:59+05:30`)
    : party.creditDays ? new Date(date.getTime() + party.creditDays * 86400_000) : null;

  const invoice = await db.$transaction(async (tx) => {
    // Atomically reserve the next number in this business's series.
    const b = await tx.business.update({ where: { id: business.id }, data: { nextInvoiceNo: { increment: 1 } } });
    const number = `${b.invoicePrefix}${b.nextInvoiceNo - 1}`;
    const inv = await tx.invoice.create({
      data: {
        businessId: business.id, partyId: party.id, number, date, dueDate, placeOfSupply: d.placeOfSupply, interState,
        taxablePaise: BigInt(totals.taxable), cgstPaise: BigInt(totals.cgst), sgstPaise: BigInt(totals.sgst),
        igstPaise: BigInt(totals.igst), roundOffPaise: BigInt(totals.roundOff), totalPaise: BigInt(totals.total),
        notes: d.notes || null, shareToken: newShareToken(), createdById: user.id,
        lines: {
          create: lines.map((l, i) => ({
            itemId: l.itemId || null, description: l.description, hsn: l.hsn || null, qtyMilli: l.qtyMilli, unit: l.unit,
            ratePaise: BigInt(l.ratePaise), taxRateBp: l.taxRateBp,
            taxablePaise: BigInt(totals.lines[i].taxable), cgstPaise: BigInt(totals.lines[i].cgst),
            sgstPaise: BigInt(totals.lines[i].sgst), igstPaise: BigInt(totals.lines[i].igst), totalPaise: BigInt(totals.lines[i].total),
          })),
        },
      },
    });
    // Every invoice posts to the party ledger (PRD flow F1).
    await tx.ledgerEntry.create({
      data: {
        businessId: business.id, partyId: party.id, direction: "GAVE", amountPaise: BigInt(totals.total), date, dueDate,
        note: `Invoice ${number}`, source: "INVOICE", invoiceId: inv.id, createdById: user.id,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "Invoice", entityId: inv.id, data: { number, totals } });
    return inv;
  });
  redirect(`/invoices/${invoice.id}`);
}
