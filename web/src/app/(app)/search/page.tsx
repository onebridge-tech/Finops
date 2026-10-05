import Link from "next/link";
import type { ReactNode } from "react";
import { requireBusiness } from "@/lib/auth";
import { search, SEARCH_TYPES, type SearchType } from "@/lib/search";
import { formatINR } from "@/lib/money";
import { Card, Input, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Search" };

const LABEL: Record<SearchType, string> = { parties: "Parties", entries: "Entries", invoices: "Invoices", quotes: "Quotations", items: "Items", receipts: "Receipts" };

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const type = SEARCH_TYPES.includes(sp.type as SearchType) ? (sp.type as SearchType) : undefined;
  const ctx = await requireBusiness();
  const r = await search(ctx, q, type, type ? 50 : 8);
  const total = r ? Object.values(r).reduce((s, list) => s + list.length, 0) : 0;
  const href = (t?: SearchType) => `/search?${new URLSearchParams({ q, ...(t ? { type: t } : {}) })}`;

  return (
    <>
      <PageHeader title="Search" />
      <form className="mb-4">
        <Input name="q" defaultValue={q} autoFocus placeholder="Name, phone, GSTIN, invoice no., note, item, amount…" />
        {type && <input type="hidden" name="type" value={type} />}
      </form>
      {q && (
        <nav className="mb-4 flex flex-wrap gap-1 text-sm">
          <Link href={href()} className={`rounded-lg px-3 py-1.5 ${!type ? "bg-brand text-brand-ink" : "text-muted hover:bg-card"}`}>All</Link>
          {SEARCH_TYPES.map((t) => (
            <Link key={t} href={href(t)} className={`rounded-lg px-3 py-1.5 ${type === t ? "bg-brand text-brand-ink" : "text-muted hover:bg-card"}`}>
              {LABEL[t]}{r && !type && r[t].length > 0 && ` (${r[t].length}${r[t].length === 8 ? "+" : ""})`}
            </Link>
          ))}
        </nav>
      )}
      {!r ? (
        <p className="text-sm text-muted">Type at least 2 characters.</p>
      ) : total === 0 ? (
        <Card className="text-sm text-muted">Nothing found for “{q}”.</Card>
      ) : (
        <div className="space-y-6">
          <Group title="Parties" items={r.parties.map((p) => <Row key={p.id} href={`/parties/${p.id}`} main={p.name} sub={[p.phone && `+${p.phone}`, p.gstin, p.type.toLowerCase()].filter(Boolean).join(" · ")} />)} />
          <Group title="Entries" items={r.entries.map((e) => <Row key={e.id} href={`/parties/${e.partyId}`} main={`${e.party.name} · ${e.note ?? (e.direction === "GAVE" ? "You gave" : "You got")}`} sub={fmtDate(e.date)} amount={`${formatINR(e.amountPaise)} ${e.direction === "GAVE" ? "gave" : "got"}`} />)} />
          <Group title="Invoices" items={r.invoices.map((i) => <Row key={i.id} href={`/invoices/${i.id}`} main={`${i.number} · ${i.party.name}`} sub={`${fmtDate(i.date)}${i.status === "CANCELLED" ? " · cancelled" : ""}`} amount={formatINR(i.totalPaise)} />)} />
          <Group title="Quotations" items={r.quotes.map((x) => <Row key={x.id} href={`/quotes/${x.id}`} main={`${x.number} · ${x.party.name}`} sub={`${fmtDate(x.date)} · ${x.status.toLowerCase()}`} amount={formatINR(x.totalPaise)} />)} />
          <Group title="Items" items={r.items.map((i) => <Row key={i.id} href={`/items/${i.id}`} main={i.variantName ? `${i.name} — ${i.variantName}` : i.name} sub={[i.sku, i.hsn && `HSN ${i.hsn}`, i.archivedAt && "archived"].filter(Boolean).join(" · ")} amount={formatINR(i.pricePaise)} />)} />
          <Group title="Receipts" items={r.receipts.map((x) => <Row key={x.id} href={`/r/${x.shareToken}`} main={`${x.number} · ${x.party.name}`} sub={fmtDate(x.date)} amount={formatINR(x.amountPaise)} />)} />
        </div>
      )}
    </>
  );
}

function Group({ title, items }: { title: string; items: ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted">{title}</h2>
      <Card className="divide-y divide-line p-0 text-sm">{items}</Card>
    </section>
  );
}

function Row({ href, main, sub, amount }: { href: string; main: string; sub?: string; amount?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-bg">
      <span className="min-w-0">
        <span className="block truncate font-medium">{main}</span>
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </span>
      {amount && <span className="shrink-0 tabular-nums">{amount}</span>}
    </Link>
  );
}
