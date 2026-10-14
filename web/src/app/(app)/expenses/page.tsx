import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { fileUrl } from "@/lib/files";
import { PAYMENT_MODE_LABEL, todayIST, type PaymentMode } from "@/lib/format";
import { rangeDates, resolvePeriod } from "@/lib/period";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { Card, Field, Input, PageHeader, Select, fmtDate } from "@/components/ui";
import { ExpenseForm, VoidExpense } from "./forms";

export const metadata = { title: "Shop expenses" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Expenses({ searchParams }: PageProps<"/expenses">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("ledger:write");
  const today = todayIST();
  const period = resolvePeriod({ period: one(sp.period) || "month", from: one(sp.from), to: one(sp.to) }, today);
  const { gte, lte } = rangeDates(period.from, period.to);
  const [expenses, used, vendors, branches, files] = await Promise.all([
    db.expense.findMany({ where: { businessId: ctx.business.id, ...(ctx.branchId ? { branchId: ctx.branchId } : {}), ...(ctx.assignedOnly || ctx.role === "REP" ? { createdById: ctx.user.id } : {}), date: { gte, lte }, ...(one(sp.cat) ? { category: one(sp.cat) } : {}) }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 300 }),
    db.expense.findMany({ where: { businessId: ctx.business.id }, distinct: ["category"], select: { category: true } }),
    db.party.findMany({ where: { businessId: ctx.business.id, archivedAt: null, type: { in: ["SUPPLIER", "BOTH"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ctx.membership.branchId ? null : db.branch.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.storedFile.findMany({ where: { businessId: ctx.business.id, expenseId: { not: null } }, select: { id: true, expenseId: true } }),
  ]);
  const categories = [...new Set([...EXPENSE_CATEGORIES, ...used.map((u) => u.category)])];
  const receipt = new Map(files.map((f) => [f.expenseId!, f.id]));
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const branchName = new Map((branches ?? []).map((b) => [b.id, b.name]));
  const live = expenses.filter((x) => !x.voidedAt);
  const total = live.reduce((s, x) => s + Number(x.amountPaise), 0);

  return (
    <>
      <PageHeader title="Shop expenses" sub={`${period.from} to ${period.to} · ${formatINR(total)}`} action={can(ctx.role, "reports:view") ? <Link href="/reports/expenses" className="text-sm text-brand underline">Where the money went</Link> : undefined} />
      <Card className="mb-4"><ExpenseForm today={today} categories={categories} vendors={vendors} branches={branches && branches.length ? branches : null} /></Card>

      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <Field label="Period"><Select name="period" defaultValue={period.preset}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="month">This month</option><option value="lastmonth">Last month</option><option value="quarter">This quarter</option><option value="fy">This financial year</option><option value="custom">Custom</option></Select></Field>
        <Field label="From"><Input name="from" type="date" defaultValue={period.from} /></Field>
        <Field label="To"><Input name="to" type="date" defaultValue={period.to} /></Field>
        <Field label="Category"><Select name="cat" defaultValue={one(sp.cat)}><option value="">All</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink">Show</button>
      </form>

      {expenses.length === 0 ? <Card className="text-sm text-muted">No expenses in this period.</Card> : (
        <Card className="divide-y divide-line p-0 text-sm">
          {expenses.map((x) => (
            <div key={x.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${x.voidedAt ? "text-muted line-through" : ""}`}>
              <span>
                <span className="font-medium">{x.category}</span>
                <span className="block text-xs text-muted no-underline">
                  {fmtDate(x.date)} · {PAYMENT_MODE_LABEL[x.paymentMode as PaymentMode] ?? x.paymentMode}
                  {x.vendorId && ` · ${vendorName.get(x.vendorId) ?? "supplier"}`}{x.branchId && branchName.get(x.branchId) && ` · ${branchName.get(x.branchId)}`}
                  {x.note && ` · ${x.note}`}{x.voidedAt && ` · voided: ${x.voidReason}`}
                  {receipt.get(x.id) && <> · <a href={fileUrl(receipt.get(x.id))!} target="_blank" className="text-brand underline">receipt</a></>}
                </span>
              </span>
              <span className="flex items-center gap-4">
                <span className="font-semibold tabular-nums">{formatINR(x.amountPaise)}</span>
                {!x.voidedAt && can(ctx.role, "ledger:reverse") && <VoidExpense id={x.id} />}
              </span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
