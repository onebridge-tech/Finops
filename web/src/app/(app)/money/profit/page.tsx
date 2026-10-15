import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { istDay } from "@/lib/ledger";
import { collectedThisMonth, isMonth, monthBounds, monthLabel, profitAndLoss, receivablesNow, shiftMonth, trend } from "@/lib/finance";
import { Badge, Card, PageHeader, SectionTitle, StatCard, buttonClass } from "@/components/ui";
import { Icon } from "@/components/icon";

export const metadata = { title: "Profit & loss" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const signed = (p: number) => `${p < 0 ? "−" : ""}${formatINR(Math.abs(p))}`;
const pct = (a: number, b: number) => (b === 0 ? "—" : `${Math.round((a / b) * 100)}%`);

export default async function Profit({ searchParams }: PageProps<"/money/profit">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("reports:view");
  const m = isMonth(one(sp.m)) ? one(sp.m) : istDay(new Date()).slice(0, 7);
  const { gte, lte } = monthBounds(m);
  const [pl, flow, owed, series, unrecorded] = await Promise.all([
    profitAndLoss(ctx, m), collectedThisMonth(ctx, m), receivablesNow(ctx), trend(ctx, m, 6),
    db.bankTxn.count({ where: { businessId: ctx.business.id, date: { gte, lte }, direction: "OUT", expenseId: null, entryId: null, category: { notIn: ["Cash withdrawn", "Owner’s own use"] } } }),
  ]);
  const max = Math.max(1, ...series.flatMap((x) => [x.netSales, x.expenses + x.cogs, Math.abs(x.netProfit)]));
  const margin = pl.netSales === 0 ? null : Math.round((pl.netProfit / pl.netSales) * 100);

  return (
    <>
      <PageHeader
        title="Profit & loss"
        sub={`${monthLabel(m)} · from your bills and expenses`}
        action={<Link href={`/money?m=${m}`} className={buttonClass("secondary")}><Icon name="wallet" size={16} />Money in & out</Link>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`/money/profit?m=${shiftMonth(m, -1)}`} aria-label="Earlier month" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card shadow-sm hover:bg-bg"><Icon name="chevron" size={16} className="rotate-180" /></Link>
        <form className="flex items-center gap-2"><input type="month" name="m" defaultValue={m} aria-label="Month" className="h-9 rounded-lg border border-line bg-card px-2.5 text-sm shadow-sm" /><button className={buttonClass("secondary")}>Show</button></form>
        <Link href={`/money/profit?m=${shiftMonth(m, 1)}`} aria-label="Later month" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card shadow-sm hover:bg-bg"><Icon name="chevron" size={16} /></Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="bill" label="Sales" value={formatINR(pl.netSales)} hint={`${pl.invoices} bill${pl.invoices === 1 ? "" : "s"}${pl.returns ? `, after ${formatINR(pl.returns)} returned` : ""}. Before GST`} />
        <StatCard icon="box" label={pl.costBasis === "purchases" ? "Stock you bought" : "Cost of what you sold"} value={formatINR(pl.cogs)} hint={pl.costBasis === "purchases" ? "What you paid suppliers this month" : pl.costBasis === "none" ? "No cost known yet" : pl.costCoverage < 100 ? `Known for ${pl.costCoverage}% of sales` : "From your items’ buying prices"} />
        <StatCard icon="arrowUp" label="Shop expenses" value={formatINR(pl.expenses)} tone="gave" hint="Rent, salaries, transport and so on" />
        <StatCard icon="trend" label="Profit" value={signed(pl.netProfit)} tone={pl.netProfit >= 0 ? "got" : "gave"} hint={margin === null ? "No sales this month" : `${margin}% of sales`} />
      </div>

      {pl.costBasis !== "purchases" && pl.costCoverage < 100 && pl.netSales > 0 && (
        <Card className="mt-4 border-warn/30 bg-warn/5 text-sm">
          <p className="font-medium">Your profit is higher than it really is</p>
          <p className="text-muted">We only know what you paid for items that have a <b>buying price</b> set. That is {pl.costCoverage}% of this month’s sales. Add the buying price in <Link href="/items" className="font-medium text-brand underline">Your items</Link> to get the true profit.</p>
        </Card>
      )}
      {pl.costBasis === "purchases" && pl.netSales > 0 && (
        <Card className="mt-4 border-line text-sm">
          <p className="font-medium">Cost is based on the stock you paid for this month</p>
          <p className="text-muted">Most of your items have no <b>buying price</b>, so we used what you paid suppliers instead. That is a fair guide, but stock bought and not yet sold (or sold from older stock) makes a month look better or worse than it is. Add buying prices in <Link href="/items" className="font-medium text-brand underline">Your items</Link> for a truer figure.</p>
        </Card>
      )}
      {unrecorded > 0 && (
        <Card className="mt-4 border-brand/30 bg-brand-soft text-sm">
          <p className="font-medium">{unrecorded} spending line{unrecorded === 1 ? "" : "s"} from your bank statement {unrecorded === 1 ? "is" : "are"} not in your expenses</p>
          <p className="text-muted">They are left out of this profit. <Link href={`/money?m=${m}`} className="font-medium text-brand underline">Add them from Money in & out</Link>.</p>
        </Card>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>How the profit works out</SectionTitle>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {[
              ["Sales (before GST)", pl.sales, ""], ["Less: goods returned", -pl.returns, ""], ["Net sales", pl.netSales, "font-semibold"],
              [pl.costBasis === "purchases" ? "Less: stock you bought this month" : "Less: cost of what you sold", -pl.cogs, ""], ["Gross profit", pl.grossProfit, "font-semibold"],
              ["Less: shop expenses", -pl.expenses, ""], ["Profit", pl.netProfit, "font-semibold text-base"],
            ].map(([label, v, cls]) => (
              <div key={label as string} className={`flex justify-between px-4 py-2.5 text-sm ${cls}`}><span>{label}</span><span className={`tabular-nums ${(v as number) < 0 && !String(cls).includes("font-semibold") ? "text-muted" : ""}`}>{signed(v as number)}</span></div>
            ))}
          </Card>
          <p className="mt-2 text-xs text-muted">GST you collect is not your income, so sales are counted before GST.</p>
        </section>
        <section>
          <SectionTitle>Shop expenses</SectionTitle>
          <Card className="space-y-3">
            {pl.expenseByCategory.length === 0 && <p className="text-sm text-muted">No expenses recorded for this month.</p>}
            {pl.expenseByCategory.map((e) => (
              <div key={e.category}>
                <div className="mb-1 flex justify-between text-sm"><span>{e.category}</span><span className="tabular-nums"><span className="font-medium">{formatINR(e.paise)}</span> <span className="text-xs text-muted">{pct(e.paise, pl.expenses)}</span></span></div>
                <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-gave/70" style={{ width: `${(e.paise / (pl.expenseByCategory[0]?.paise || 1)) * 100}%` }} /></div>
              </div>
            ))}
          </Card>
        </section>
      </div>

      <SectionTitle>Money you actually handled this month</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon="arrowDown" label="Received from customers" value={formatINR(flow.received)} tone="got" hint="Payments written in customer accounts" />
        <StatCard icon="arrowUp" label="Given on credit" value={formatINR(flow.creditGiven)} hint="Goods given and not yet paid for" />
        <StatCard icon="wallet" label="Customers still owe you" value={formatINR(owed)} tone="gave" hint="Right now, across all customers" href="/collections" />
      </div>

      <SectionTitle>Last 6 months</SectionTitle>
      <Card>
        <div className="grid grid-cols-6 gap-2 sm:gap-4" role="img" aria-label="Sales, costs and profit for the last six months">
          {series.map((x) => (
            <div key={x.month} className="flex flex-col items-center gap-2">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div className="w-full max-w-4 rounded-t bg-brand" style={{ height: `${x.netSales ? Math.max(4, (x.netSales / max) * 100) : 0}%` }} title={`Sales ${formatINR(x.netSales)}`} />
                <div className="w-full max-w-4 rounded-t bg-gave/60" style={{ height: `${x.expenses + x.cogs ? Math.max(4, ((x.expenses + x.cogs) / max) * 100) : 0}%` }} title={`Costs ${formatINR(x.expenses + x.cogs)}`} />
                <div className={`w-full max-w-4 rounded-t ${x.netProfit >= 0 ? "bg-got" : "bg-warn"}`} style={{ height: `${x.netProfit ? Math.max(4, (Math.abs(x.netProfit) / max) * 100) : 0}%` }} title={`Profit ${signed(x.netProfit)}`} />
              </div>
              <Link href={`/money/profit?m=${x.month}`} className={`text-xs hover:underline ${x.month === m ? "font-semibold text-ink" : "text-muted"}`}>{new Date(`${x.month}-15T12:00:00+05:30`).toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</Link>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-brand" />Sales</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-gave/60" />Costs and expenses</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-got" />Profit</span></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[460px] text-sm">
            <thead className="text-left text-xs font-medium text-muted"><tr><th className="py-1.5">Month</th><th className="py-1.5 text-right">Sales</th><th className="py-1.5 text-right">Costs</th><th className="py-1.5 text-right">Profit</th></tr></thead>
            <tbody className="divide-y divide-line">
              {[...series].reverse().map((x) => (
                <tr key={x.month}><td className="py-2">{monthLabel(x.month)}</td><td className="py-2 text-right tabular-nums">{formatINR(x.netSales)}</td><td className="py-2 text-right tabular-nums">{formatINR(x.expenses + x.cogs)}</td><td className={`py-2 text-right font-medium tabular-nums ${x.netProfit < 0 ? "text-gave" : ""}`}>{signed(x.netProfit)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Badge>Estimate</Badge>This is a quick view for decisions, not a statement for your accountant or for tax.</p>
    </>
  );
}
