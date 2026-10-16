import Link from "next/link";
import { partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { kindOf } from "@/lib/categorize";
import { isMonth, monthBounds, monthLabel, monthsWithStatements, shiftMonth } from "@/lib/finance";
import { istDay } from "@/lib/ledger";
import { suggestParty } from "@/lib/match-party";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { MatchForm } from "./match-form";

export const metadata = { title: "Match payments to customers" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function Match({ searchParams }: PageProps<"/money/match">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("cash:manage");
  const months = await monthsWithStatements(ctx.business.id);
  const m = isMonth(one(sp.m)) ? one(sp.m) : (months[0] ?? istDay(new Date()).slice(0, 7));
  const { gte, lte } = monthBounds(m);
  const [lines, parties] = await Promise.all([
    db.bankTxn.findMany({ where: { businessId: ctx.business.id, direction: "IN", expenseId: null, entryId: null, date: { gte, lte } }, orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 200 }),
    db.party.findMany({ where: { ...partyWhere(ctx), archivedAt: null, type: { in: ["CUSTOMER", "BOTH", "LEAD"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const open = lines.filter((t) => kindOf(t.category) === "income");
  const rows = open.map((t) => ({
    id: t.id, date: istDay(t.date), description: t.description, counterparty: t.counterparty, amountPaise: Number(t.amountPaise),
    suggestion: suggestParty(t.counterparty ?? t.description, parties)?.id ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Match payments to customers"
        sub={`${monthLabel(m)} · money that came into your bank and is not in any customer’s account yet`}
        action={<Link href={`/money?m=${m}`} className="text-sm text-brand underline">Back to Money in & out</Link>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={`/money/match?m=${shiftMonth(m, -1)}`} aria-label="Earlier month" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card shadow-sm hover:bg-bg"><Icon name="chevron" size={16} className="rotate-180" /></Link>
        <span className="text-sm font-medium">{monthLabel(m)}</span>
        <Link href={`/money/match?m=${shiftMonth(m, 1)}`} aria-label="Later month" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card shadow-sm hover:bg-bg"><Icon name="chevron" size={16} /></Link>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="check" title="Nothing to match">Every payment that came in this month is already in a customer’s account, or no statement has been added for this month.</EmptyState>
      ) : parties.length === 0 ? (
        <Card className="text-sm text-muted">Add your customers first, then come back to match their payments.</Card>
      ) : (
        <MatchForm rows={rows} parties={parties} />
      )}
    </>
  );
}
