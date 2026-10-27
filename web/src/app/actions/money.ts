"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { findParty, requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { MAX_IMPORT_ROWS, readTable } from "@/lib/spreadsheet";
import { buildTxns, checkBalances, counterparty, FIELDS, findHeaderRow, guessMapping, txnHash, type Mapping, type Txn } from "@/lib/bank-import";
import { categorize, categoryInfo, kindOf } from "@/lib/categorize";
import { monthBounds } from "@/lib/finance";
import { istDay } from "@/lib/ledger";
import { formatINR, roundHalfUp } from "@/lib/money";
import { issueReceipt } from "@/lib/receipts";
import { issueInvoice } from "@/lib/doc-core";
import { GST_RATES_BP } from "@/lib/gst";
import type { Prisma } from "@prisma/client";
import type { BalanceCheck } from "@/lib/bank-import";

export type StatementPreview = {
  error?: string;
  fileName?: string;
  header?: string[];
  rows?: string[][];
  mapping?: Mapping;
  sample?: { date: string; description: string; direction: string; amountPaise: number; category: string }[];
  totals?: { count: number; inPaise: number; outPaise: number; from: string; to: string; duplicates: number; errors: { row: number; reason: string }[] };
  /** Running-balance check; null when the statement has no balance column. */
  balance?: BalanceCheck | null;
  /** The statement was a PDF, read on the person's device. */
  fromPdf?: boolean;
};
export type StatementResult = { error?: string };

// Limits for rows read from a PDF on the person's device.
const PDF_MAX_ROWS = 5000, PDF_MAX_COLS = 30, PDF_MAX_CELL = 500;

const noon = (ymd: string) => new Date(`${ymd}T12:00:00+05:30`);

async function rulesFor(businessId: string) {
  return db.categoryRule.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
}

/** Looks at the file and what the chosen columns would give, without saving anything. */
async function analyse(businessId: string, table: string[][], headerRow: number, mapping: Mapping) {
  const rows = table.slice(headerRow + 1);
  const { txns, errors } = buildTxns(rows, mapping, headerRow + 2);
  const hashes = txns.map(txnHash);
  const existing = hashes.length ? await db.bankTxn.findMany({ where: { businessId, hash: { in: hashes } }, select: { hash: true } }) : [];
  const have = new Set(existing.map((e) => e.hash));
  const rules = await rulesFor(businessId);
  const dates = txns.map((t) => t.date).sort();
  return {
    txns, errors,
    balance: checkBalances(txns),
    sample: txns.slice(0, 8).map((t) => ({ date: t.date, description: t.description, direction: t.direction, amountPaise: t.amountPaise, category: categorize(t.description, t.direction, rules) })),
    totals: {
      count: txns.length, inPaise: txns.filter((t) => t.direction === "IN").reduce((s, t) => s + t.amountPaise, 0), outPaise: txns.filter((t) => t.direction === "OUT").reduce((s, t) => s + t.amountPaise, 0),
      from: dates[0] ?? "", to: dates.at(-1) ?? "", duplicates: hashes.filter((h) => have.has(h)).length, errors: errors.slice(0, 20),
    },
  };
}

/** Step 1: read the file, find the table, guess the columns. */
export async function previewStatement(_prev: StatementPreview, form: FormData): Promise<StatementPreview> {
  const ctx = await requireBusiness("cash:manage");
  let table: string[][];
  let fileName: string;
  const fromPdf = form.has("pdfTable");
  if (fromPdf) {
    // A PDF is opened on the person's device (components/pdf-statement.ts); only the rows read from it come here.
    try {
      table = JSON.parse(String(form.get("pdfTable")));
      if (!Array.isArray(table) || !table.every((r) => Array.isArray(r) && r.every((c) => typeof c === "string"))) throw new Error();
      // The rows come from the person's browser, so keep them to what a real statement can hold.
      if (table.length > PDF_MAX_ROWS) return { error: `That statement has more than ${PDF_MAX_ROWS.toLocaleString("en-IN")} lines. Add it a few months at a time.` };
      if (table.some((r) => r.length > PDF_MAX_COLS || r.some((c) => c.length > PDF_MAX_CELL))) throw new Error();
    } catch {
      return { error: "Something went wrong reading the PDF. Please add it again." };
    }
    fileName = String(form.get("fileName") ?? "Statement.pdf").slice(0, 120);
  } else {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Choose your statement file" };
    if (file.size > 8_000_000) return { error: "That file is too large (8 MB at most)" };
    if (/\.pdf$/i.test(file.name)) return { error: "Please add the PDF again; it is opened on your device, not uploaded." };
    try {
      table = await readTable(file);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not read the file" };
    }
    fileName = file.name;
  }
  if (table.length < 2) return { error: "The file has no rows" };
  const headerRow = findHeaderRow(table);
  const header = table[headerRow] ?? [];
  const mapping = guessMapping(header);
  const rows = table.slice(headerRow + 1);
  if (rows.length > MAX_IMPORT_ROWS) return { error: `At most ${MAX_IMPORT_ROWS} rows at a time. Split the file by month.` };
  const a = await analyse(ctx.business.id, table, headerRow, mapping);
  return { fileName, header, rows, mapping, sample: a.sample, totals: a.totals, balance: a.balance, fromPdf };
}

/** Same preview again after the person fixed a column. The rows come back from the page, so the file is not read twice. */
export async function repreviewStatement(_prev: StatementPreview, form: FormData): Promise<StatementPreview> {
  const ctx = await requireBusiness("cash:manage");
  let header: string[], rows: string[][], mapping: Mapping;
  try {
    header = JSON.parse(String(form.get("header")));
    rows = JSON.parse(String(form.get("rows")));
    mapping = readMapping(form);
  } catch {
    return { error: "Something went wrong. Please add the file again." };
  }
  const a = await analyse(ctx.business.id, [header, ...rows], 0, mapping);
  return { fileName: String(form.get("fileName") ?? ""), header, rows, mapping, sample: a.sample, totals: a.totals, balance: a.balance, fromPdf: form.get("fromPdf") === "1" };
}

function readMapping(form: FormData): Mapping {
  const m: Mapping = {};
  for (const f of FIELDS) {
    const v = String(form.get(`map_${f.key}`) ?? "");
    if (v !== "" && /^\d+$/.test(v)) m[f.key] = Number(v);
  }
  return m;
}

/** Step 2: save the transactions. A transaction already imported before (from an overlapping statement) is skipped. */
export async function commitStatement(_prev: StatementResult, form: FormData): Promise<StatementResult> {
  const ctx = await requireBusiness("cash:manage");
  let header: string[], rows: string[][];
  try {
    header = JSON.parse(String(form.get("header")));
    rows = JSON.parse(String(form.get("rows")));
  } catch {
    return { error: "Something went wrong. Please add the file again." };
  }
  if (!Array.isArray(rows) || rows.length > MAX_IMPORT_ROWS) return { error: "Invalid file data" };
  const mapping = readMapping(form);
  if (mapping.date === undefined) return { error: "Choose the Date column" };
  if (mapping.amount === undefined && mapping.debit === undefined && mapping.credit === undefined) return { error: "Choose the amount columns (Money out and Money in, or one Amount column)" };

  const { txns } = buildTxns(rows, mapping);
  if (txns.length === 0) return { error: "No transactions could be read with these columns" };
  const check = checkBalances(txns);
  if (check && check.mismatches.length > 0 && form.get("balanceChecked") !== "1") return { error: "Some balances don’t add up. Check those rows against your statement, then tick the box to add it anyway." };
  const rules = await rulesFor(ctx.business.id);
  const name = String(form.get("name") ?? "").trim().slice(0, 80) || String(form.get("fileName") ?? "Statement").slice(0, 80);
  const dates = txns.map((t) => t.date).sort();
  const stmt = await db.statement.create({
    data: { businessId: ctx.business.id, name, fileName: String(form.get("fileName") ?? "").slice(0, 120) || null, fromDate: noon(dates[0]!), toDate: noon(dates.at(-1)!), rows: rows.length, createdById: ctx.user.id },
  });
  const data = txns.map((t: Txn) => ({
    businessId: ctx.business.id, statementId: stmt.id, date: noon(t.date), description: t.description.slice(0, 300), direction: t.direction, amountPaise: BigInt(t.amountPaise),
    balancePaise: t.balancePaise === null ? null : BigInt(t.balancePaise), ref: t.ref?.slice(0, 60) ?? null, category: categorize(t.description, t.direction, rules),
    counterparty: counterparty(t.description), hash: txnHash(t),
  }));
  const made = await db.bankTxn.createMany({ data, skipDuplicates: true });
  await db.$transaction(async (tx) => {
    await tx.statement.update({ where: { id: stmt.id }, data: { imported: made.count, duplicates: txns.length - made.count } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "import_statement", entity: "Statement", entityId: stmt.id, data: { name, imported: made.count, duplicates: txns.length - made.count } });
  });
  revalidatePath("/money");
  redirect(`/money?m=${dates.at(-1)!.slice(0, 7)}&imported=${made.count}&dup=${txns.length - made.count}`);
}

/** Moves a transaction to another group, remembers the choice for the same payee, and applies it to the others not yet corrected. */
export async function setCategory(form: FormData): Promise<void> {
  const ctx = await requireBusiness("cash:manage");
  const id = String(form.get("id") ?? "");
  const category = String(form.get("category") ?? "");
  const t = await db.bankTxn.findFirst({ where: { id, businessId: ctx.business.id } });
  const info = categoryInfo(category);
  if (!t || !info || info.direction !== t.direction) return;
  await db.bankTxn.update({ where: { id }, data: { category, manual: true } });
  const key = t.counterparty?.toLowerCase();
  if (key && key.length >= 3) {
    await db.categoryRule.upsert({
      where: { businessId_keyword: { businessId: ctx.business.id, keyword: key } },
      update: { category, direction: t.direction }, create: { businessId: ctx.business.id, keyword: key, category, direction: t.direction },
    });
    await db.bankTxn.updateMany({ where: { businessId: ctx.business.id, direction: t.direction, manual: false, description: { contains: key, mode: "insensitive" }, expenseId: null, entryId: null }, data: { category } });
  }
  revalidatePath("/money");
}

export async function deleteStatement(form: FormData): Promise<void> {
  const ctx = await requireBusiness("cash:manage");
  const id = String(form.get("id") ?? "");
  const s = await db.statement.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!s) return;
  await db.$transaction(async (tx) => {
    // Payments written in customer accounts always stay. Expenses stay too, unless the person asked to cancel them.
    if (form.get("cancelExpenses") === "1") {
      const linked = await tx.bankTxn.findMany({ where: { businessId: ctx.business.id, statementId: id, expenseId: { not: null } }, select: { expenseId: true } });
      await tx.expense.updateMany({ where: { businessId: ctx.business.id, id: { in: linked.map((l) => l.expenseId!) }, voidedAt: null }, data: { voidedAt: new Date(), voidReason: "Statement removed" } });
    }
    const n = await tx.bankTxn.deleteMany({ where: { businessId: ctx.business.id, statementId: id } });
    await tx.statement.delete({ where: { id } });
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "delete_statement", entity: "Statement", entityId: id, data: { name: s.name, lines: n.count } });
  });
  revalidatePath("/money");
  redirect("/money");
}

/** Puts spending from the statement into the shop's expenses, so it counts in profit and loss. One line or a whole month. */
export async function addToExpenses(form: FormData): Promise<void> {
  const ctx = await requireBusiness("cash:manage");
  const id = String(form.get("id") ?? "");
  const month = String(form.get("month") ?? "");
  const where = id
    ? { id, businessId: ctx.business.id }
    : { businessId: ctx.business.id, date: { gte: monthBounds(/^\d{4}-\d{2}$/.test(month) ? month : istDay(new Date()).slice(0, 7)).gte, lte: monthBounds(/^\d{4}-\d{2}$/.test(month) ? month : istDay(new Date()).slice(0, 7)).lte } };
  const list = (await db.bankTxn.findMany({ where: { ...where, direction: "OUT", expenseId: null, entryId: null } })).filter((t) => kindOf(t.category) === "spend");
  if (list.length === 0) return;
  await db.$transaction(async (tx) => {
    for (const t of list) {
      const e = await tx.expense.create({
        data: {
          businessId: ctx.business.id, branchId: ctx.branchId, date: t.date, amountPaise: t.amountPaise, category: categoryInfo(t.category)?.expense ?? "Other",
          paymentMode: "BANK", note: `${t.category}: ${t.description}`.slice(0, 200), createdById: ctx.user.id,
        },
      });
      await tx.bankTxn.update({ where: { id: t.id }, data: { expenseId: e.id } });
    }
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "statement_to_expenses", entity: "Expense", entityId: list[0]!.id, data: { lines: list.length, total: formatINR(list.reduce((s, t) => s + Number(t.amountPaise), 0)) } });
  });
  revalidatePath("/money");
  revalidatePath("/money/profit");
  revalidatePath("/expenses");
}

type Txn_ = { id: string; date: Date; amountPaise: bigint; description: string };

/** Writes one bank line as a customer's payment, with its numbered receipt, inside a transaction. Returns the ledger entry. */
async function payFromStatement(tx: Prisma.TransactionClient, ctx: Awaited<ReturnType<typeof requireBusiness>>, t: Txn_, party: { id: string; branchId: string | null }) {
  const mode = /\bupi\b|@/i.test(t.description) ? "UPI" : "BANK";
  const e = await tx.ledgerEntry.create({
    data: {
      businessId: ctx.business.id, partyId: party.id, branchId: ctx.branchId ?? party.branchId, direction: "GOT", amountPaise: t.amountPaise, date: t.date,
      note: `From bank statement: ${t.description}`.slice(0, 200), paymentMode: mode, createdById: ctx.user.id,
    },
  });
  await issueReceipt(tx, ctx.business.id, e);
  await tx.bankTxn.update({ where: { id: t.id }, data: { entryId: e.id, category: "Customer payments", manual: true } });
  return e;
}

/** Money that came in from a customer is written in that customer's account, so what they owe goes down. A receipt is made too. */
export async function recordCustomerPayment(form: FormData): Promise<void> {
  const ctx = await requireBusiness("cash:manage");
  const id = String(form.get("id") ?? "");
  const t = await db.bankTxn.findFirst({ where: { id, businessId: ctx.business.id, direction: "IN", expenseId: null, entryId: null } });
  const party = await findParty(ctx, String(form.get("partyId") ?? ""));
  if (!t || !party) return;
  await db.$transaction(async (tx) => {
    const e = await payFromStatement(tx, ctx, t, party);
    await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "statement_to_payment", entity: "LedgerEntry", entityId: e.id, data: { partyId: party.id } });
  });
  revalidatePath("/money");
  revalidatePath(`/parties/${party.id}`);
}

export type MatchState = { error?: string; ok?: string };

/**
 * Many bank lines at once: each picked line is written as that customer's payment with a receipt. With "make bills" the
 * payment is also a sale that was never billed: a GST bill is made for the amount and the payment settles it. That step
 * needs the owner to say these are real sales, because a bill is a tax document.
 */
export async function matchStatementPayments(_prev: MatchState, form: FormData): Promise<MatchState> {
  const ctx = await requireBusiness("cash:manage");
  const picks = form.getAll("pick").map(String);
  if (picks.length === 0) return { error: "Tick the lines you want to record" };
  if (picks.length > 200) return { error: "Do at most 200 lines at a time" };
  const makeBills = form.get("mode") === "BILL";
  const description = String(form.get("billItem") ?? "").trim().slice(0, 120) || "Goods supplied";
  const gst = Math.round(Number(String(form.get("billGst") ?? "18")) * 100);
  const hsn = String(form.get("billHsn") ?? "").trim();
  if (makeBills) {
    if (form.get("confirmSales") !== "on") return { error: "Tick the box to say these were real sales that have not been billed" };
    if (!GST_RATES_BP.includes(gst)) return { error: "Choose the GST rate" };
    if (hsn && !/^\d{4,8}$/.test(hsn)) return { error: "HSN/SAC should be 4 to 8 digits" };
  }
  const txns = await db.bankTxn.findMany({ where: { id: { in: picks }, businessId: ctx.business.id, direction: "IN", expenseId: null, entryId: null } });
  let done = 0;
  const missing: string[] = [];
  for (const t of txns) {
    const party = await findParty(ctx, String(form.get(`party_${t.id}`) ?? ""));
    if (!party) { missing.push(t.description.slice(0, 30)); continue; }
    await db.$transaction(async (tx) => {
      let invoiceEntryId: string | null = null;
      if (makeBills) {
        const total = Number(t.amountPaise);
        const taxable = gst === 0 ? total : roundHalfUp((total * 10000) / (10000 + gst));
        const inv = await issueInvoice(tx, {
          businessId: ctx.business.id, userId: ctx.user.id, partyId: party.id, branchId: ctx.branchId ?? party.branchId, date: t.date, dueDate: null,
          placeOfSupply: party.stateCode ?? ctx.business.stateCode, notes: "Made from a bank statement payment",
          lines: [{ itemId: null, description, hsn: hsn || null, qtyMilli: 1000, unit: "nos", ratePaise: taxable, taxRateBp: gst, discountBp: 0 }],
        });
        invoiceEntryId = (await tx.ledgerEntry.findFirst({ where: { invoiceId: inv.id, source: "INVOICE" }, select: { id: true } }))?.id ?? null;
      }
      const e = await payFromStatement(tx, ctx, t, party);
      if (invoiceEntryId) {
        const inv = await tx.ledgerEntry.findUniqueOrThrow({ where: { id: invoiceEntryId }, select: { amountPaise: true } });
        const amount = inv.amountPaise < t.amountPaise ? inv.amountPaise : t.amountPaise;
        await tx.allocation.create({ data: { businessId: ctx.business.id, partyId: party.id, receiptEntryId: e.id, invoiceEntryId, amountPaise: amount, createdById: ctx.user.id } });
      }
      await audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: makeBills ? "statement_to_bill_and_payment" : "statement_to_payment", entity: "LedgerEntry", entityId: e.id, data: { partyId: party.id, bankLine: t.id } });
    });
    done++;
  }
  revalidatePath("/money");
  revalidatePath("/money/match");
  revalidatePath("/invoices");
  revalidatePath("/parties");
  if (done === 0) return { error: missing.length ? "Choose a customer for each line you ticked" : "Those lines are already recorded" };
  return { ok: `${done} payment${done === 1 ? "" : "s"} recorded${makeBills ? " with bills" : ""}, each with a receipt.${missing.length ? ` ${missing.length} line${missing.length === 1 ? " was" : "s were"} left because no customer was chosen.` : ""}` };
}
