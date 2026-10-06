import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { mismatches, AUTO_ACCEPT_DAYS } from "@/lib/shared-ledger";
import { formatINR } from "@/lib/money";
import { acceptSharedEntry, rejectSharedEntry } from "@/app/actions/shared";
import { Card, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Shared ledgers" };

export default async function Shared() {
  const ctx = await requireBusiness("ledger:write");
  const [pending, history, off, linked] = await Promise.all([
    db.sharedEntry.findMany({ where: { businessId: ctx.business.id, status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    db.sharedEntry.findMany({ where: { businessId: ctx.business.id, status: { not: "PENDING" } }, orderBy: { resolvedAt: "desc" }, take: 20 }),
    mismatches(ctx.business.id),
    db.party.count({ where: { businessId: ctx.business.id, linkedBusinessId: { not: null }, archivedAt: null } }),
  ]);
  const ids = [...new Set([...pending, ...history].flatMap((s) => [s.counterpartBizId]))];
  const [biz, parties] = await Promise.all([
    db.business.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }),
    db.party.findMany({ where: { id: { in: [...pending, ...history].map((s) => s.partyId) } }, select: { id: true, name: true } }),
  ]);
  const bn = new Map(biz.map((b) => [b.id, b.name]));
  const pn = new Map(parties.map((p) => [p.id, p.name]));
  const what = (s: { direction: string }) => (s.direction === "GOT" ? "billed you / gave you credit" : "recorded a payment from you");

  return (
    <>
      <PageHeader title="Shared ledgers" sub={`${linked} of your parties also use the app. Entries they make appear here for you to accept.`} />

      <h2 className="mb-2 font-semibold">Waiting for you ({pending.length})</h2>
      {pending.length === 0 ? <Card className="text-sm text-muted">Nothing waiting. Unanswered entries are accepted automatically after {AUTO_ACCEPT_DAYS} days.</Card> : (
        <Card className="divide-y divide-line p-0 text-sm">
          {pending.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="font-medium">{bn.get(s.counterpartBizId) ?? "A business"}</span> {what(s)}
                <span className="block text-xs text-muted">{fmtDate(s.date)}{s.note && ` · ${s.note}`} · in your books under {pn.get(s.partyId)} · auto-accepts {fmtDate(s.autoAcceptAt)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-semibold tabular-nums">{formatINR(s.amountPaise)}</span>
                <form action={acceptSharedEntry}><input type="hidden" name="id" value={s.id} /><button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-ink">Accept</button></form>
                <form action={rejectSharedEntry}><input type="hidden" name="id" value={s.id} /><button className="text-xs text-muted underline hover:text-gave">Reject</button></form>
              </span>
            </div>
          ))}
        </Card>
      )}

      <h2 className="mb-2 mt-6 font-semibold">Books that don’t match ({off.length})</h2>
      {off.length === 0 ? <Card className="text-sm text-muted">Every linked party’s balance matches on both sides.</Card> : (
        <Card className="divide-y divide-line p-0 text-sm">
          {off.map((m) => (
            <Link key={m.partyId} href={`/parties/${m.partyId}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-bg">
              <span>{m.partyName}<span className="block text-xs text-muted">{m.counterpart}</span></span>
              <span className="text-right text-xs">
                <span className="block">You: {m.ours > 0 ? `they owe ${formatINR(m.ours)}` : m.ours < 0 ? `you owe ${formatINR(-m.ours)}` : "settled"}</span>
                <span className="block">Them: {m.theirs < 0 ? `they owe ${formatINR(-m.theirs)}` : m.theirs > 0 ? `you owe ${formatINR(m.theirs)}` : "settled"}</span>
                <span className="block font-medium text-gave">Difference {formatINR(Math.abs(m.difference))}</span>
              </span>
            </Link>
          ))}
        </Card>
      )}

      {history.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-muted">Recently handled</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {history.map((s) => (
              <div key={s.id} className="flex justify-between gap-3 px-4 py-2">
                <span>{bn.get(s.counterpartBizId)} · {fmtDate(s.date)}{s.note && ` · ${s.note}`}</span>
                <span className="text-xs text-muted">{formatINR(s.amountPaise)} · {s.status === "AUTO_ACCEPTED" ? "auto-accepted" : s.status.toLowerCase()}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  );
}
