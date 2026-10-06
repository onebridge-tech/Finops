"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseRupees } from "@/lib/money";
import { PAYMENT_MODES } from "@/lib/format";
import { checkUpload, saveUpload } from "@/lib/files";
import { expectedCash } from "@/lib/cashbook";

export type CashState = { error?: string; ok?: boolean; info?: string };

const field = (f: FormData, k: string) => String(f.get(k) ?? "");
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const ExpenseInput = z.object({
  date: ymd,
  amount: z.string(),
  category: z.string().trim().min(2, "Choose a category").max(40),
  paymentMode: z.enum(PAYMENT_MODES),
  note: z.string().trim().max(200),
  vendorId: z.string(),
  branchId: z.string(),
});

/** Records a business expense with category, mode, branch and an optional receipt photo (LG-09). */
export async function addExpense(_prev: CashState, form: FormData): Promise<CashState> {
  const ctx = await requireBusiness("ledger:write");
  const r = ExpenseInput.safeParse(Object.fromEntries(Object.keys(ExpenseInput.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const d = r.data;
  const amount = parseRupees(d.amount);
  if (!amount) return { error: "Enter an amount greater than zero" };
  if (d.date > today()) return { error: "The date can’t be in the future" };
  const receipt = form.get("receipt");
  const file = receipt instanceof File && receipt.size > 0 ? receipt : null;
  if (file) {
    const err = await checkUpload(file, "ATTACHMENT");
    if (err) return { error: `Receipt: ${err}` };
  }
  const vendor = d.vendorId ? await db.party.findFirst({ where: { id: d.vendorId, businessId: ctx.business.id, type: { in: ["SUPPLIER", "BOTH"] } } }) : null;
  const branchId = ctx.membership.branchId ?? (d.branchId && (await db.branch.count({ where: { id: d.branchId, businessId: ctx.business.id } })) ? d.branchId : ctx.branchId);

  const exp = await db.$transaction(async (tx) => {
    const x = await tx.expense.create({
      data: { businessId: ctx.business.id, branchId, date: noon(d.date), amountPaise: BigInt(amount), category: d.category, paymentMode: d.paymentMode, note: d.note || null, vendorId: vendor?.id ?? null, createdById: ctx.user.id },
    });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "Expense", entityId: x.id, data: x });
    return x;
  });
  if (file) await saveUpload(file, { businessId: ctx.business.id, userId: ctx.user.id, kind: "ATTACHMENT", expenseId: exp.id });
  revalidatePath("/expenses");
  revalidatePath("/cashbook");
  return { ok: true };
}

/** Expenses aren't deleted; voiding keeps them in the audit trail with a reason. */
export async function voidExpense(_prev: CashState, form: FormData): Promise<CashState> {
  const ctx = await requireBusiness("ledger:reverse");
  const x = await db.expense.findFirst({ where: { id: field(form, "expenseId"), businessId: ctx.business.id, voidedAt: null } });
  if (!x) return { error: "Expense not found" };
  const reason = field(form, "reason").trim();
  if (reason.length < 3) return { error: "Give a reason" };
  await db.$transaction(async (tx) => {
    await tx.expense.update({ where: { id: x.id }, data: { voidedAt: new Date(), voidReason: reason } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "void", entity: "Expense", entityId: x.id, data: { reason } });
  });
  revalidatePath("/expenses");
  revalidatePath("/cashbook");
  return { ok: true };
}

const AdjustInput = z.object({ date: ymd, direction: z.enum(["IN", "OUT"]), amount: z.string(), note: z.string().trim().min(3, "Say what this is for").max(200) });

/** Cash that isn't a sale or an expense: owner drawings, a float, a bank deposit… */
export async function addCashAdjustment(_prev: CashState, form: FormData): Promise<CashState> {
  const ctx = await requireBusiness("cash:manage");
  const r = AdjustInput.safeParse(Object.fromEntries(Object.keys(AdjustInput.shape).map((k) => [k, field(form, k)])));
  if (!r.success) return { error: r.error.issues[0].message };
  const amount = parseRupees(r.data.amount);
  if (!amount) return { error: "Enter an amount greater than zero" };
  await db.$transaction(async (tx) => {
    const x = await tx.cashAdjustment.create({
      data: { businessId: ctx.business.id, branchId: ctx.branchId, date: noon(r.data.date), direction: r.data.direction, amountPaise: BigInt(amount), note: r.data.note, createdById: ctx.user.id },
    });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "create", entity: "CashAdjustment", entityId: x.id, data: x });
  });
  revalidatePath("/cashbook");
  return { ok: true };
}

export async function voidCashAdjustment(form: FormData): Promise<void> {
  const ctx = await requireBusiness("cash:manage");
  const x = await db.cashAdjustment.findFirst({ where: { id: field(form, "adjustmentId"), businessId: ctx.business.id, voidedAt: null } });
  if (!x) return;
  await db.$transaction(async (tx) => {
    await tx.cashAdjustment.update({ where: { id: x.id }, data: { voidedAt: new Date() } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "void", entity: "CashAdjustment", entityId: x.id });
  });
  revalidatePath("/cashbook");
}

/** The cash in hand the app expects on opening day. */
export async function setOpeningCash(_prev: CashState, form: FormData): Promise<CashState> {
  const ctx = await requireBusiness("settings:write");
  const v = parseRupees(field(form, "opening") || "0");
  if (v === null) return { error: "Enter an amount like 5000" };
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: ctx.business.id }, data: { cashOpeningPaise: BigInt(v) } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "update", entity: "Business", entityId: ctx.business.id, data: { cashOpeningPaise: v } });
  });
  revalidatePath("/cashbook");
  return { ok: true, info: "Saved" };
}

/** Day close: the counted cash against what the books expect, with the difference recorded (LG-08). */
export async function closeDay(_prev: CashState, form: FormData): Promise<CashState> {
  const ctx = await requireBusiness("cash:manage");
  const date = field(form, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) return { error: "Pick a day up to today" };
  const counted = parseRupees(field(form, "counted"));
  if (counted === null) return { error: "Enter the cash you counted" };
  const branchId = ctx.branchId ?? (field(form, "branchId") || null);
  const expected = await expectedCash(ctx, date, branchId);
  const key = branchId ?? "ALL";
  const data = { expectedPaise: BigInt(expected), countedPaise: BigInt(counted), differencePaise: BigInt(counted - expected), note: field(form, "note").trim() || null, closedById: ctx.user.id };
  await db.$transaction(async (tx) => {
    const c = await tx.dayClose.upsert({ where: { businessId_branchKey_date: { businessId: ctx.business.id, branchKey: key, date } }, create: { businessId: ctx.business.id, branchKey: key, date, ...data }, update: data });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "day_close", entity: "DayClose", entityId: c.id, data: { date, expected, counted } });
  });
  revalidatePath("/cashbook");
  const diff = counted - expected;
  return { ok: true, info: diff === 0 ? "Cash matches the books." : `${diff > 0 ? "Over" : "Short"} by ₹${(Math.abs(diff) / 100).toFixed(2)} — recorded.` };
}
