import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { todayIST } from "@/lib/format";
import { rangeDates, resolvePeriod } from "@/lib/period";
import { PURCHASE_KIND_LABEL, type PurchaseKind } from "@/lib/purchase";
import { AddPanel, Badge, Card, Field, Input, PageHeader, Select, StatCard, fmtDate } from "@/components/ui";
import { PurchaseForm, VoidPurchase } from "./forms";

export const metadata = { title: "Purchase bills" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Purchases({ searchParams }: PageProps<"/purchases">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("invoice:write");
  const today = todayIST();
  const period = resolvePeriod({ period: one(sp.period) || "month", from: one(sp.from), to: one(sp.to) }, today);
  const { gte, lte } = rangeDates(period.from, period.to);
  const [bills, suppliers] = await Promise.all([
    db.purchaseBill.findMany({ where: { businessId: ctx.business.id, ...(ctx.branchId ? { OR: [{ branchId: ctx.branchId }, { branchId: null }] } : {}), date: { gte, lte } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 300 }),
    db.party.findMany({ where: { businessId: ctx.business.id, archivedAt: null, type: { in: ["SUPPLIER", "BOTH"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const live = bills.filter((b) => !b.voidedAt);
  const sum = (f: (b: (typeof live)[number]) => bigint) => live.reduce((s, b) => s + Number(f(b)), 0);
  const taxable = sum((b) => b.taxablePaise);
  const gst = sum((b) => b.cgstPaise + b.sgstPaise + b.igstPaise);
  const credit = live.filter((b) => b.itcEligible).reduce((s, b) => s + Number(b.cgstPaise + b.sgstPaise + b.igstPaise), 0);

  return (
    <>
      <PageHeader
        title="Purchase bills"
        sub={`${period.from} to ${period.to}`}
        action={
          <span className="flex flex-wrap items-center gap-3 text-sm">
            {(["xlsx", "csv"] as const).map((f) => <a key={f} href={`/export/purchases?format=${f}`} className="text-brand underline">{f === "xlsx" ? "Excel" : "CSV"}</a>)}
            <Link href="/data?tab=purchases" className="text-brand underline">Import from Excel</Link>
          </span>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="box" label="Bought (before GST)" value={formatINR(taxable)} hint={`${live.length} bill${live.length === 1 ? "" : "s"}`} />
        <StatCard icon="bill" label="GST paid to suppliers" value={formatINR(gst)} hint="CGST, SGST and IGST together" />
        <StatCard icon="check" label="GST you can claim back" value={formatINR(credit)} tone="got" hint="Input tax credit, on bills with a supplier GSTIN" />
        <StatCard icon="warning" label="Cannot be claimed" value={formatINR(gst - credit)} hint="No GSTIN, or marked not eligible" />
      </div>
      <AddPanel title="Add a supplier bill" open={bills.length === 0}><PurchaseForm today={today} suppliers={suppliers} businessState={ctx.business.stateCode} /></AddPanel>

      <form className="mb-4 flex flex-wrap items-end gap-3 text-sm">
        <Field label="Period"><Select name="period" defaultValue={period.preset}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="month">This month</option><option value="lastmonth">Last month</option><option value="quarter">This quarter</option><option value="fy">This financial year</option><option value="lastfy">Last financial year</option><option value="custom">Custom</option></Select></Field>
        <Field label="From"><Input name="from" type="date" defaultValue={period.from} /></Field>
        <Field label="To"><Input name="to" type="date" defaultValue={period.to} /></Field>
        <button className="rounded-lg bg-brand px-4 py-2 font-medium text-brand-ink">Show</button>
      </form>

      {bills.length === 0 ? (
        <Card className="text-sm text-muted">No supplier bills in this period. Add the bills you receive so the GST you paid can be claimed back and your GST return is complete.</Card>
      ) : (
        <Card className="divide-y divide-line p-0 text-sm">
          {bills.map((b) => (
            <div key={b.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${b.voidedAt ? "text-muted line-through" : ""}`}>
              <span className="min-w-0">
                <span className="font-medium">{b.supplierName}</span>{" "}
                <span className="text-muted no-underline">· {b.number}</span>
                <span className="block text-xs text-muted no-underline">
                  {fmtDate(b.date)} · {PURCHASE_KIND_LABEL[b.kind as PurchaseKind] ?? b.kind}{b.supplierGstin && ` · ${b.supplierGstin}`}
                  {" · "}GST {formatINR(b.cgstPaise + b.sgstPaise + b.igstPaise)}{b.interState ? " (IGST)" : ""}
                  {b.note && ` · ${b.note}`}{b.voidedAt && ` · cancelled: ${b.voidReason}`}
                </span>
              </span>
              <span className="flex items-center gap-3">
                {!b.voidedAt && (b.itcEligible ? <Badge tone="good">Claimable</Badge> : <Badge tone="warn">No credit</Badge>)}
                <span className="font-semibold tabular-nums">{formatINR(b.totalPaise)}</span>
                {!b.voidedAt && can(ctx.role, "ledger:reverse") && <VoidPurchase id={b.id} />}
              </span>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
