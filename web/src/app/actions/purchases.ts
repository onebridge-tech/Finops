"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseRupees } from "@/lib/money";
import { GST_RATES_BP } from "@/lib/gst";
import { isValidGstin, normalizeGstin, STATES } from "@/lib/gstin";
import { isInterStateBill, PURCHASE_KINDS, splitTax, type PurchaseKind, type Tax } from "@/lib/purchase";

export type PurchaseState = { error?: string; ok?: boolean; info?: string };

const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Adds a supplier bill. It is a tax record; "also add to expenses" is what makes it count in profit. */
export async function addPurchaseBill(_prev: PurchaseState, form: FormData): Promise<PurchaseState> {
  const ctx = await requireBusiness("invoice:write");
  const { business, user } = ctx;

  const supplier = field(form, "partyId")
    ? await db.party.findFirst({ where: { id: field(form, "partyId"), businessId: business.id, type: { in: ["SUPPLIER", "BOTH"] } } })
    : null;
  const supplierName = supplier?.name ?? field(form, "supplierName");
  if (!supplierName) return { error: "Choose a supplier or type the supplier’s name" };
  const gstin = normalizeGstin(supplier?.gstin ?? field(form, "gstin"));
  if (gstin && !isValidGstin(gstin)) return { error: "That GSTIN is not valid" };

  const number = field(form, "number");
  if (!number) return { error: "Enter the supplier’s bill number" };
  const date = field(form, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick the bill date" };
  if (date > today()) return { error: "The bill date can’t be in the future" };

  const taxable = parseRupees(field(form, "taxable"));
  if (!taxable) return { error: "Enter the taxable value (the amount before GST)" };

  const stateCode = gstin ? gstin.slice(0, 2) : supplier?.stateCode ?? (field(form, "state") in STATES ? field(form, "state") : null);
  const inter = isInterStateBill(business.stateCode, stateCode);

  let tax: Tax;
  const exact = ["cgst", "sgst", "igst"].map((k) => field(form, k));
  if (exact.some(Boolean)) {
    const [c, s, i] = exact.map((v) => (v ? parseRupees(v) : 0));
    if (c === null || s === null || i === null) return { error: "Tax amounts must be amounts like 90 or 90.50" };
    tax = { cgst: c, sgst: s, igst: i };
  } else {
    const rateBp = Math.round(Number(field(form, "rate")) * 100);
    if (!GST_RATES_BP.includes(rateBp)) return { error: "Choose the GST rate" };
    tax = splitTax(taxable, rateBp, inter);
  }
  const total = taxable + tax.cgst + tax.sgst + tax.igst;
  const kind = field(form, "kind") as PurchaseKind;
  if (!PURCHASE_KINDS.includes(kind)) return { error: "Choose what was bought" };
  const itcEligible = form.get("itcEligible") === "on" && !!gstin;

  const dup = await db.purchaseBill.findFirst({
    where: { businessId: business.id, voidedAt: null, number, ...(gstin ? { supplierGstin: gstin } : { supplierName: { equals: supplierName, mode: "insensitive" } }) },
    select: { id: true },
  });
  if (dup) return { error: "A bill with this number from this supplier is already recorded" };

  const addExpense = form.get("alsoExpense") === "on";
  await db.$transaction(async (tx) => {
    let expenseId: string | null = null;
    if (addExpense) {
      const e = await tx.expense.create({
        data: {
          businessId: business.id, branchId: ctx.branchId, date: noon(date), amountPaise: BigInt(total),
          category: kind === "GOODS" ? "Stock purchases" : kind === "CAPITAL" ? "Equipment" : field(form, "category") || "Other",
          paymentMode: field(form, "paymentMode") || "BANK", note: `Bill ${number} from ${supplierName}`, vendorId: supplier?.id ?? null, createdById: user.id,
        },
      });
      expenseId = e.id;
      await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "Expense", entityId: e.id, data: e });
    }
    const b = await tx.purchaseBill.create({
      data: {
        businessId: business.id, branchId: ctx.branchId, partyId: supplier?.id ?? null, supplierName, supplierGstin: gstin || null, number, date: noon(date),
        stateCode, interState: inter, taxablePaise: BigInt(taxable), cgstPaise: BigInt(tax.cgst), sgstPaise: BigInt(tax.sgst), igstPaise: BigInt(tax.igst),
        totalPaise: BigInt(total), kind, itcEligible, note: field(form, "note") || null, expenseId, createdById: user.id,
      },
    });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "create", entity: "PurchaseBill", entityId: b.id, data: b });
  });
  revalidatePath("/purchases");
  revalidatePath("/expenses");
  return { ok: true };
}

/** Bills are not deleted; voiding keeps them in the history with a reason. */
export async function voidPurchaseBill(_prev: PurchaseState, form: FormData): Promise<PurchaseState> {
  const ctx = await requireBusiness("ledger:reverse");
  const b = await db.purchaseBill.findFirst({ where: { id: field(form, "billId"), businessId: ctx.business.id, voidedAt: null } });
  if (!b) return { error: "Bill not found" };
  const reason = field(form, "reason");
  if (reason.length < 3) return { error: "Give a reason" };
  await db.$transaction(async (tx) => {
    await tx.purchaseBill.update({ where: { id: b.id }, data: { voidedAt: new Date(), voidReason: reason } });
    if (b.expenseId) await tx.expense.updateMany({ where: { id: b.expenseId, businessId: ctx.business.id, voidedAt: null }, data: { voidedAt: new Date(), voidReason: `Bill ${b.number} voided: ${reason}` } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "void", entity: "PurchaseBill", entityId: b.id, data: { reason } });
  });
  revalidatePath("/purchases");
  revalidatePath("/expenses");
  return { ok: true };
}
