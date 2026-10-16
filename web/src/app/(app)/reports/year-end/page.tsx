import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { fyLabel, fyRange, loadYearEnd } from "@/lib/year-end";
import { fyStartYear } from "@/lib/period";
import { todayIST } from "@/lib/format";
import { formatINR } from "@/lib/money";
import { TAX_RULES } from "@/lib/tax-estimate";
import { Card, PageHeader, SectionTitle, StatCard, buttonClass } from "@/components/ui";
import { Icon } from "@/components/icon";

export const metadata = { title: "Year-end pack & tax estimate" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default async function YearEnd({ searchParams }: PageProps<"/reports/year-end">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("reports:view");
  const current = fyStartYear(todayIST());
  const asked = Number(one(sp.fy));
  const fy = Number.isInteger(asked) && asked >= 2017 && asked <= current ? asked : current;
  const { tax, totals, counts, sheets } = await loadYearEnd(ctx, fy);
  const years = Array.from({ length: Math.min(6, current - 2017 + 1) }, (_, i) => current - i);
  const { from, to } = fyRange(fy);

  return (
    <>
      <PageHeader
        title="Year-end pack & tax estimate"
        sub={`Financial year ${fyLabel(fy)} · ${from} to ${to}`}
        action={<a href={`/reports/year-end/export?fy=${fy}`} className={buttonClass("primary")}><Icon name="download" size={16} />Download pack for your accountant (Excel)</a>}
      />
      <nav aria-label="Financial year" className="mb-5 flex flex-wrap gap-1.5">
        {years.map((y) => (
          <Link key={y} href={`/reports/year-end?fy=${y}`} aria-current={y === fy ? "page" : undefined} className={`rounded-full border px-3 py-1 text-sm font-medium transition ${y === fy ? "border-brand bg-brand text-brand-ink" : "border-line bg-card text-muted hover:text-ink"}`}>{fyLabel(y)}</Link>
        ))}
      </nav>

      <Card className="mb-5 border-warn/30 bg-warn/5 text-sm">
        <p className="font-medium">Prepared from your entries. An estimate, not tax advice.</p>
        <p className="text-muted">The numbers are only as complete as what has been entered: bills, supplier bills, expenses and cash sales. Give the Excel pack to your chartered accountant to check and file.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="bill" label="Turnover" value={formatINR(totals.turnover)} hint={`${counts.invoices} bills · after returns · with cash sales`} />
        <StatCard icon="box" label="Bought from suppliers" value={formatINR(totals.purchTotal)} hint={`${counts.purchases} supplier bills · before GST`} />
        <StatCard icon="wallet" label="Shop expenses" value={formatINR(totals.expTotal)} tone="gave" hint={`${counts.expenses} entries`} />
        <StatCard icon="trend" label="Profit (from your entries)" value={formatINR(totals.profit)} tone={totals.profit >= 0 ? "got" : "gave"} hint="Estimate" />
      </div>

      <SectionTitle>Income tax worksheet</SectionTitle>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-line text-left text-xs font-medium text-muted"><tr><th className="px-4 py-2">Way of working it out</th><th className="px-4 py-2 text-right">Profit taxed</th><th className="px-4 py-2 text-right">Tax</th><th className="px-4 py-2 text-right">With 4% cess</th></tr></thead>
          <tbody className="divide-y divide-line tabular-nums">
            <tr>
              <td className="px-4 py-3"><span className="font-medium">Presumptive (section 44AD)</span><span className="block text-xs text-muted">{tax.digitalShare}% of receipts were digital · {tax.presumptive.eligible ? "your turnover is within the limit" : `above the limit of ${rupees(tax.presumptive.limit)}`}</span></td>
              <td className="px-4 py-3 text-right">{rupees(tax.presumptive.deemedProfit)}</td>
              <td className="px-4 py-3 text-right">{rupees(tax.presumptive.tax.slabTax - tax.presumptive.tax.rebate)}</td>
              <td className="px-4 py-3 text-right font-semibold">{rupees(tax.presumptive.tax.total)}</td>
            </tr>
            <tr>
              <td className="px-4 py-3"><span className="font-medium">From your books</span><span className="block text-xs text-muted">The profit your entries show</span></td>
              <td className="px-4 py-3 text-right">{rupees(tax.books.profit)}</td>
              <td className="px-4 py-3 text-right">{rupees(tax.books.tax.slabTax - tax.books.tax.rebate)}</td>
              <td className="px-4 py-3 text-right font-semibold">{rupees(tax.books.tax.total)}</td>
            </tr>
          </tbody>
        </table>
      </Card>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
        {tax.notes.map((n) => <li key={n}>{n}</li>)}
        <li>Slabs and the rebate are set in <code>lib/tax-estimate.ts</code> for FY {TAX_RULES.fy} and must be checked each year against the Income Tax Department’s published rates.</li>
      </ul>

      <SectionTitle>What is in the Excel pack</SectionTitle>
      <Card className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {sheets.map((s) => <p key={s.name} className="flex items-center gap-2"><Icon name="check" size={14} className="shrink-0 text-got" />{s.name}<span className="text-xs text-muted">· {s.rows.length}</span></p>)}
      </Card>
      <p className="mt-3 text-sm text-muted">For monthly GST figures and the GSTR-1 file, open <Link href="/reports/gst" className="font-medium text-brand underline">GST returns</Link>.</p>
    </>
  );
}
