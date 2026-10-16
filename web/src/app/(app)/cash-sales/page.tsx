import Link from "next/link";
import { can, partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { todayIST } from "@/lib/format";
import { rangeDates, resolvePeriod } from "@/lib/period";
import { AddPanel, Card, Field, Input, PageHeader, Select, StatCard, fmtDate } from "@/components/ui";
import { AssignCashSale, CashSaleForm, VoidCashSale } from "./forms";

export const metadata = { title: "Cash sales" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function CashSales({ searchParams }: PageProps<"/cash-sales">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("ledger:write");
  const today = todayIST();
  const period = resolvePeriod({ period: one(sp.period) || "month", from: one(sp.from), to: one(sp.to) }, today);
  const { gte, lte } = rangeDates(period.from, period.to);
  const [sales, parties] = await Promise.all([
    db.cashSale.findMany({ where: { businessId: ctx.business.id, ...(ctx.branchId ? { branchId: ctx.branchId } : {}), date: { gte, lte } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 300 }),
    db.party.findMany({ where: { ...partyWhere(ctx), archivedAt: null, type: { in: ["CUSTOMER", "BOTH", "LEAD"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const live = sales.filter((s) => !s.voidedAt);
  const total = live.reduce((s, x) => s + Number(x.amountPaise), 0);
  const cash = live.filter((x) => x.paymentMode === "CASH").reduce((s, x) => s + Number(x.amountPaise), 0);

  return (
    <>
      <PageHeader
        title="Cash sales"
        sub={`${period.from} to ${period.to} · sales with no customer name`}
        action={
          <span className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/paper-notes" className="text-brand underline">Read a paper note</Link>
            <a href={`${"/export/cashsales"}?format=xlsx`} className="text-brand underline">Excel</a>
            <Link href="/data?tab=import&kind=cashsales" className="text-brand underline">Import</Link>
          </span>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon="bill" label="Sold" value={formatINR(total)} hint={`${live.length} sale${live.length === 1 ? "" : "s"}`} tone="got" />
        <StatCard icon="wallet" label="Of it in cash" value={formatINR(cash)} hint="Goes into your cash book" />
        <StatCard icon="trend" label="By UPI, bank or card" value={formatINR(total - cash)} hint="Already in the bank" />
      </div>
      <AddPanel title="Write a sale" open={sales.length === 0}><CashSaleForm today={today} /></AddPanel>
      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <Field label="Period"><Select name="period" defaultValue={period.preset}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="month">This month</option><option value="lastmonth">Last month</option><option value="quarter">This quarter</option><option value="fy">This financial year</option><option value="custom">Custom</option></Select></Field>
        <Field label="From"><Input name="from" type="date" defaultValue={period.from} /></Field>
        <Field label="To"><Input name="to" type="date" defaultValue={period.to} /></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink">Show</button>
      </form>

      {sales.length === 0 ? <Card className="text-sm text-muted">No sales in this period. Write one above, or photograph a page of your paper notes.</Card> : (
        <Card className="divide-y divide-line p-0 text-sm">
          {sales.map((s) => (
            <div key={s.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${s.voidedAt ? "text-muted line-through" : ""}`}>
              <span className="min-w-0">
                <span className="font-medium">{s.item}</span>{s.qtyMilli !== null && <span className="text-muted no-underline"> × {s.qtyMilli / 1000}</span>}
                <span className="block text-xs text-muted no-underline">{fmtDate(s.date)} · {s.paymentMode.toLowerCase()}{s.source === "NOTE_PHOTO" && " · from a paper note"}{s.voidedAt && ` · cancelled: ${s.voidReason}`}</span>
              </span>
              <span className="flex items-center gap-3">
                {!s.voidedAt && <AssignCashSale id={s.id} value={s.partyId} parties={parties} />}
                <span className="font-semibold tabular-nums">{formatINR(s.amountPaise)}</span>
                {!s.voidedAt && can(ctx.role, "ledger:reverse") && <VoidCashSale id={s.id} />}
              </span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
