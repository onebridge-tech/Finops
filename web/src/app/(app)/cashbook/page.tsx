import Link from "next/link";
import { forbidden } from "next/navigation";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashbook } from "@/lib/cashbook";
import { formatINR, toRupeeString } from "@/lib/money";
import { resolvePeriod } from "@/lib/period";
import { todayIST } from "@/lib/format";
import { voidCashAdjustment } from "@/app/actions/cash";
import { Card, Field, Input, PageHeader, Select, fmtDate } from "@/components/ui";
import { AdjustmentForm, CloseDayForm, OpeningCashForm } from "./forms";

export const metadata = { title: "Cash in the drawer" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Cashbook({ searchParams }: PageProps<"/cashbook">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("ledger:write");
  // The cash book lists every customer's payments, so it is not for staff limited to their own customers.
  if (ctx.assignedOnly || ctx.role === "REP") forbidden();
  const today = todayIST();
  const period = resolvePeriod({ period: one(sp.period) || "month", from: one(sp.from), to: one(sp.to) }, today);
  const branches = ctx.membership.branchId ? [] : await db.branch.findMany({ where: { businessId: ctx.business.id, archivedAt: null }, orderBy: { name: "asc" } });
  const branchId = ctx.membership.branchId ?? (one(sp.branch) || null);
  const book = await cashbook(ctx, period.from, period.to, branchId);
  const manage = can(ctx.role, "cash:manage");
  const adjustments = manage ? await db.cashAdjustment.findMany({ where: { businessId: ctx.business.id, voidedAt: null, date: { gte: new Date(`${period.from}T00:00:00+05:30`) } }, orderBy: { date: "desc" }, take: 20 }) : [];

  return (
    <>
      <PageHeader title="Cash in the drawer" sub={`${period.from} to ${period.to} · cash in hand ${formatINR(book.closing)}`} action={<Link href="/expenses" className="text-sm text-brand underline">Shop expenses</Link>} />

      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <Field label="Period"><Select name="period" defaultValue={period.preset}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="month">This month</option><option value="lastmonth">Last month</option><option value="custom">Custom</option></Select></Field>
        <Field label="From"><Input name="from" type="date" defaultValue={period.from} /></Field>
        <Field label="To"><Input name="to" type="date" defaultValue={period.to} /></Field>
        {branches.length > 0 && (
          <Field label="Branch"><Select name="branch" defaultValue={branchId ?? ""}><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
        )}
        <button className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink">Show</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-muted">Opening cash</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatINR(book.opening)}</p></Card>
        <Card><p className="text-sm text-muted">In − out in period</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatINR(book.closing - book.opening)}</p></Card>
        <Card><p className="text-sm text-muted">Cash at the end</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatINR(book.closing)}</p></Card>
      </div>

      <h2 className="mb-2 mt-6 font-semibold">Day by day</h2>
      {book.days.length === 0 ? <Card className="text-sm text-muted">No cash moved in this period. Cash receipts, cash expenses and adjustments appear here by themselves.</Card> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-line bg-bg/50 text-left text-xs font-medium text-muted">
              <tr><th className="px-3 py-2">Day</th><th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2 text-right">In</th><th className="px-3 py-2 text-right">Out</th><th className="px-3 py-2 text-right">Expected close</th><th className="px-3 py-2">Counted</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...book.days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-2">{fmtDate(new Date(`${d.date}T12:00:00+05:30`))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatINR(d.opening)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-got">{formatINR(d.in)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gave">{formatINR(d.out)}</td>
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{formatINR(d.closing)}</td>
                  <td className="px-3 py-2 text-xs">
                    {d.close ? (
                      <span className={d.close.difference === 0 ? "text-got" : "text-gave"}>
                        {formatINR(d.close.counted)} · {d.close.difference === 0 ? "matched" : `${d.close.difference > 0 ? "over" : "short"} ${formatINR(Math.abs(d.close.difference))}`}
                      </span>
                    ) : <span className="text-muted">not closed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {manage && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="space-y-3"><h2 className="font-semibold">Close today</h2><p className="text-xs text-muted">Count the cash in the drawer and type it here. If it doesn’t match your records, we note the difference.</p><CloseDayForm today={today} branchId={branchId ?? ""} /></Card>
          <Card className="space-y-3"><h2 className="font-semibold">Other cash movements</h2><AdjustmentForm today={today} /></Card>
        </div>
      )}

      <h2 className="mb-2 mt-6 font-semibold">All cash movements</h2>
      <Card className="divide-y divide-line p-0 text-sm">
        {book.rows.length === 0 && <p className="px-4 py-3 text-muted">None.</p>}
        {[...book.rows].reverse().map((m, i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
            <span>
              {m.ref ? <Link href={m.ref} className="hover:underline">{m.label}</Link> : m.label}
              <span className="block text-xs text-muted">{fmtDate(m.at)}</span>
            </span>
            <span className="text-right tabular-nums">
              <span className={m.direction === "IN" ? "text-got" : "text-gave"}>{m.direction === "IN" ? "+" : "−"}{formatINR(m.amountPaise)}</span>
              <span className="block text-xs text-muted">bal {formatINR(m.balance)}</span>
            </span>
          </div>
        ))}
      </Card>

      {adjustments.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">Recent adjustments (can be voided)</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {adjustments.map((a) => (
              <form key={a.id} action={voidCashAdjustment} className="flex items-center justify-between gap-3 px-4 py-2">
                <input type="hidden" name="adjustmentId" value={a.id} />
                <span>{a.note}<span className="block text-xs text-muted">{fmtDate(a.date)} · {a.direction === "IN" ? "in" : "out"} {formatINR(a.amountPaise)}</span></span>
                <button className="text-xs text-muted underline hover:text-gave">Cancel</button>
              </form>
            ))}
          </Card>
        </>
      )}

      {can(ctx.role, "settings:write") && (
        <Card className="mt-6"><OpeningCashForm value={toRupeeString(Number(ctx.business.cashOpeningPaise))} /></Card>
      )}
    </>
  );
}
