import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { REPORT_KINDS, REPORT_TITLES, runReport, type ReportKind } from "@/lib/report-runner";
import { daybookFilters, DAYBOOK_TYPES } from "@/lib/reports";
import { PERIOD_PRESETS } from "@/lib/period";
import { ReportTable } from "@/components/report-table";
import { PrintButton } from "@/components/print-button";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";

export const metadata = { title: "Report" };

type Sp = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ReportPage({ params, searchParams }: PageProps<"/reports/[kind]">) {
  const { kind } = await params;
  if (!REPORT_KINDS.includes(kind as ReportKind)) notFound();
  const k = kind as ReportKind;
  const sp = (await searchParams) as Sp;
  const ctx = await requireBusiness("reports:view");
  const { result, period } = await runReport(ctx, k, sp);
  const meta = REPORT_TITLES[k];
  const dbk = k === "daybook" ? await daybookFilters(ctx) : null;
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([a, b]) => (typeof b === "string" && b ? [[a, b]] : []))).toString();

  return (
    <>
      <PageHeader
        title={result.title}
        sub={meta.needsPeriod ? `${period.label}` : meta.about}
        action={
          <div className="no-print flex flex-wrap gap-2">
            <a href={`/reports/${k}/export?${qs}&format=xlsx`} className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium hover:bg-bg">Excel</a>
            <a href={`/reports/${k}/export?${qs}&format=csv`} className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium hover:bg-bg">CSV</a>
            <PrintButton />
          </div>
        }
      />
      <Link href="/reports" className="no-print mb-3 inline-block text-sm text-muted underline">← All reports</Link>

      <form className="no-print mb-4 flex flex-wrap items-end gap-3 text-sm">
        {meta.needsPeriod && (
          <>
            <Field label="Period">
              <Select name="period" defaultValue={period.preset}>{PERIOD_PRESETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            </Field>
            <Field label="From"><Input name="from" type="date" defaultValue={period.from} /></Field>
            <Field label="To"><Input name="to" type="date" defaultValue={period.to} /></Field>
          </>
        )}
        {k === "ageing" && <Choice name="by" value={one(sp.by) || "party"} label="Group by" options={[["party", "Party"], ["rep", "Rep"], ["branch", "Branch"]]} />}
        {k === "top" && (
          <>
            <Choice name="dim" value={one(sp.dim) || "customers"} label="Rank" options={[["customers", "Customers"], ["items", "Items"], ["suppliers", "Suppliers"], ["reps", "Reps"]]} />
            <Choice name="metric" value={one(sp.metric) || "value"} label="By" options={[["value", "Value"], ["margin", "Margin"]]} />
            <Choice name="n" value={one(sp.n) || "10"} label="Top" options={[["5", "5"], ["10", "10"], ["50", "50"]]} />
          </>
        )}
        {k === "attendance" && <Choice name="by" value={one(sp.by) || "days"} label="Show" options={[["days", "Days per rep"], ["log", "Daily log"]]} />}
        {k === "sales" && <Choice name="by" value={one(sp.by) || "month"} label="Group by" options={[["month", "Month"], ["item", "Item"], ["category", "Category"], ["location", "Location"], ["rep", "Rep"], ["branch", "Branch"], ["customer", "Customer"]]} />}
        {k === "expenses" && <Choice name="by" value={one(sp.by) || "category"} label="Group by" options={[["category", "Category"], ["branch", "Branch"], ["month", "Month"], ["entries", "All entries"]]} />}
        {k === "sources" && <Choice name="by" value={one(sp.by) || "source"} label="Group by" options={[["source", "Lead source"], ["rep", "Rep"]]} />}
        {k === "orders" && <Choice name="kind" value={one(sp.kind) || "SALES"} label="Orders" options={[["SALES", "Sales"], ["PURCHASE", "Purchase"]]} />}
        {k === "stock" && (
          <label className="flex items-center gap-2 pb-2"><input type="checkbox" name="low" value="1" defaultChecked={one(sp.low) === "1"} className="size-4 accent-[var(--brand)]" /> Low stock only</label>
        )}
        {dbk && (
          <>
            <Choice name="type" value={one(sp.type)} label="Type" options={[["", "All"], ...DAYBOOK_TYPES.map((t) => [t, t] as [string, string])]} />
            <Choice name="user" value={one(sp.user)} label="User" options={[["", "Everyone"], ...dbk.users.map((u) => [u.id, u.name] as [string, string])]} />
            {dbk.branches.length > 0 && <Choice name="branch" value={one(sp.branch)} label="Branch" options={[["", "All"], ["none", "Shared"], ...dbk.branches.map((b) => [b.id, b.name] as [string, string])]} />}
          </>
        )}
        <button className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink">Show</button>
      </form>

      {result.note && <p className="mb-3 text-sm text-muted">{result.note}</p>}
      <ReportTable result={result} />
      <Card className="hidden print:block print:border-0 print:p-0 text-xs text-muted">Generated {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</Card>
    </>
  );
}

function Choice({ name, value, label, options }: { name: string; value: string; label: string; options: [string, string][] }) {
  return (
    <Field label={label}>
      <Select name={name} defaultValue={value}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
    </Field>
  );
}
