import Link from "next/link";
import { partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { categoriesFor, categoryInfo, kindOf } from "@/lib/categorize";
import { isMonth, monthLabel, monthsWithStatements, moneySummary, monthBounds, shiftMonth } from "@/lib/finance";
import { istDay } from "@/lib/ledger";
import { deleteStatement, addToExpenses } from "@/app/actions/money";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle, StatCard, buttonClass } from "@/components/ui";
import { Icon } from "@/components/icon";
import { CategorySelect, TxnActions } from "./txn-controls";

export const metadata = { title: "Money in & out" };

const PAGE = 50;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function BarList({ items, tone }: { items: { label: string; paise: number; note?: string }[]; tone: "got" | "gave" }) {
  const max = Math.max(1, ...items.map((i) => i.paise));
  const total = items.reduce((s, i) => s + i.paise, 0) || 1;
  if (items.length === 0) return <p className="text-sm text-muted">Nothing here this month.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{i.label}{i.note && <span className="text-xs text-muted"> · {i.note}</span>}</span>
            <span className="shrink-0 tabular-nums"><span className="font-medium">{formatINR(i.paise)}</span> <span className="text-xs text-muted">{Math.round((i.paise / total) * 100)}%</span></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${tone === "got" ? "bg-got" : "bg-gave"}`} style={{ width: `${(i.paise / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default async function Money({ searchParams }: PageProps<"/money">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("reports:view");
  const manage = ctx.role === "OWNER" || ctx.role === "ADMIN" || ctx.role === "ACCOUNTANT";
  const months = await monthsWithStatements(ctx.business.id);
  const today = istDay(new Date()).slice(0, 7);
  const m = isMonth(one(sp.m)) ? one(sp.m) : (months[0] ?? today);
  const dir = one(sp.dir) === "IN" || one(sp.dir) === "OUT" ? (one(sp.dir) as "IN" | "OUT") : null;
  const cat = one(sp.cat);
  const q = one(sp.q).trim();
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const { gte, lte } = monthBounds(m);

  const statements = await db.statement.findMany({ where: { businessId: ctx.business.id }, orderBy: { createdAt: "desc" }, take: 20 });
  if (statements.length === 0) {
    return (
      <>
        <PageHeader title="Money in & out" sub="See how much came in, how much you spent, and what is left." action={manage && <LinkButton href="/money/import"><Icon name="plus" size={16} />Add a statement</LinkButton>} />
        <EmptyState icon="wallet" title="Add your first bank statement" action={manage ? <LinkButton href="/money/import"><Icon name="plus" size={16} />Add a statement</LinkButton> : undefined}>
          Download your monthly statement from your bank as Excel or CSV and add it here. We read it, sort every line into groups like Rent, Salaries and Stock, and show you what you spent and earned.
        </EmptyState>
        <Card className="mt-5 text-sm">
          <p className="font-medium">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted">
            <li>Add the file. We find the columns by their names.</li>
            <li>Check the preview, then import. Lines already added before are skipped.</li>
            <li>Fix any group we guessed wrong. We remember it for next time.</li>
            <li>Add spending to your expenses, and see your <Link className="font-medium text-brand underline" href="/money/profit">profit and loss</Link>.</li>
          </ol>
        </Card>
      </>
    );
  }

  const where = { businessId: ctx.business.id, date: { gte, lte }, ...(dir ? { direction: dir } : {}), ...(cat ? { category: cat } : {}), ...(q ? { description: { contains: q, mode: "insensitive" as const } } : {}) };
  const [s, txns, total, parties, unrecorded] = await Promise.all([
    moneySummary(ctx.business.id, m),
    db.bankTxn.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE, take: PAGE }),
    db.bankTxn.count({ where }),
    db.party.findMany({ where: { ...partyWhere(ctx), archivedAt: null, type: { in: ["CUSTOMER", "BOTH", "LEAD"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.bankTxn.findMany({ where: { businessId: ctx.business.id, date: { gte, lte }, direction: "OUT", expenseId: null, entryId: null }, select: { category: true, amountPaise: true } }),
  ]);
  const loose = unrecorded.filter((t) => kindOf(t.category) === "spend");
  const looseTotal = loose.reduce((a, t) => a + Number(t.amountPaise), 0);
  const maxDay = Math.max(1, ...s.daily.flatMap((d) => [d.in, d.out]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (o: Record<string, string | number | null>) => `/money?${new URLSearchParams(Object.entries({ m, dir, cat, q, page: null, ...o }).filter(([, v]) => v !== null && v !== "" && v !== undefined) as [string, string][])}`;
  const suggest = (name: string | null) => (name ? (parties.find((p) => p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase()))?.id ?? null) : null);
  const imported = Number(one(sp.imported));
  const dup = Number(one(sp.dup));
  const allCats = [...categoriesFor("IN"), ...categoriesFor("OUT")].map((c) => c.name);
  const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });

  return (
    <>
      <PageHeader
        title="Money in & out"
        sub={`${monthLabel(m)} · from your bank statements`}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href={`/money/profit?m=${m}`} variant="secondary"><Icon name="chart" size={16} />Profit & loss</LinkButton>
            {manage && <LinkButton href="/money/import"><Icon name="plus" size={16} />Add a statement</LinkButton>}
          </div>
        }
      />

      {imported > 0 && <p role="status" className="mb-4 rounded-lg bg-got/10 px-3 py-2.5 text-sm text-got">Added {imported} transaction{imported === 1 ? "" : "s"}{dup > 0 ? `. ${dup} were already here and were skipped.` : "."}</p>}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Link href={href({ m: shiftMonth(m, -1) })} aria-label="Earlier month" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card shadow-sm hover:bg-bg"><Icon name="chevron" size={16} className="rotate-180" /></Link>
        <form className="flex items-center gap-2">
          <input type="month" name="m" defaultValue={m} aria-label="Month" className="h-9 rounded-lg border border-line bg-card px-2.5 text-sm shadow-sm" />
          <button className={buttonClass("secondary")}>Show</button>
        </form>
        <Link href={href({ m: shiftMonth(m, 1) })} aria-label="Later month" className="flex size-9 items-center justify-center rounded-lg border border-line bg-card shadow-sm hover:bg-bg"><Icon name="chevron" size={16} /></Link>
        {months.length > 0 && <span className="ml-1 text-xs text-muted">Statements added for: {months.slice(0, 6).map((x) => <Link key={x} href={href({ m: x })} className="mr-2 underline hover:text-ink">{x}</Link>)}</span>}
      </div>

      {s.count === 0 ? (
        <EmptyState icon="calendar" title={`Nothing recorded for ${monthLabel(m)}`}>{months.length ? "Pick another month, or add a statement that covers this one." : undefined}</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon="arrowDown" label="Money earned" value={formatINR(s.income)} tone="got" hint="From customers and other income" />
            <StatCard icon="arrowUp" label="Money spent" value={formatINR(s.spend)} tone="gave" hint="Stock, rent, salaries and so on" />
            <StatCard icon="trend" label="Left over" value={`${s.left < 0 ? "−" : ""}${formatINR(Math.abs(s.left))}`} tone={s.left >= 0 ? "got" : "gave"} hint={s.left >= 0 ? "Earned minus spent" : "You spent more than you earned"} />
            <StatCard icon="wallet" label="Moved, not spent" value={formatINR(s.transferOut)} hint={`Cash taken out and your own use. ${formatINR(s.transferIn)} put in`} />
          </div>
          {s.balance && <p className="mt-3 text-sm text-muted">Bank balance: {formatINR(s.balance.opening)} at the start of the month, {formatINR(s.balance.closing)} at the end.</p>}

          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold tracking-tight">Day by day</h2>
              <div className="flex items-center gap-4 text-xs text-muted"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-got" />Came in</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-gave/70" />Went out</span></div>
            </div>
            <div className="mt-4 flex h-32 items-end gap-[3px]" role="img" aria-label="Money in and out for each day of the month">
              {s.daily.map((d) => (
                <div key={d.day} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px" title={`${d.day}: in ${formatINR(d.in)}, out ${formatINR(d.out)}`}>
                  <div className="w-full max-w-2 rounded-t bg-got" style={{ height: `${d.in ? Math.max(4, (d.in / maxDay) * 100) : 0}%` }} />
                  <div className="w-full max-w-2 rounded-t bg-gave/70" style={{ height: `${d.out ? Math.max(4, (d.out / maxDay) * 100) : 0}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-muted"><span>1</span><span>{s.daily.length}</span></div>
          </Card>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section>
              <SectionTitle>Where the money went</SectionTitle>
              <Card><BarList tone="gave" items={s.spendByCategory.filter((c) => kindOf(c.category) === "spend").map((c) => ({ label: c.category, paise: c.paise, note: `${c.count}` }))} /></Card>
              {s.topSpend.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-sm font-semibold">Paid the most to</h3>
                  <Card className="divide-y divide-line p-0 sm:p-0">{s.topSpend.map((p) => <div key={p.name} className="flex justify-between px-4 py-2.5 text-sm"><span>{p.name} <span className="text-xs text-muted">· {p.count}</span></span><span className="font-medium tabular-nums">{formatINR(p.paise)}</span></div>)}</Card>
                </>
              )}
            </section>
            <section>
              <SectionTitle>Where it came from</SectionTitle>
              <Card><BarList tone="got" items={s.incomeByCategory.filter((c) => kindOf(c.category) === "income").map((c) => ({ label: c.category, paise: c.paise, note: `${c.count}` }))} /></Card>
              {s.topIncome.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-sm font-semibold">Received the most from</h3>
                  <Card className="divide-y divide-line p-0 sm:p-0">{s.topIncome.map((p) => <div key={p.name} className="flex justify-between px-4 py-2.5 text-sm"><span>{p.name} <span className="text-xs text-muted">· {p.count}</span></span><span className="font-medium tabular-nums text-got">{formatINR(p.paise)}</span></div>)}</Card>
                </>
              )}
            </section>
          </div>

          {manage && loose.length > 0 && (
            <Card className="mt-8 flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand-soft">
              <div>
                <p className="font-semibold">{loose.length} spending line{loose.length === 1 ? "" : "s"} ({formatINR(looseTotal)}) not in your expenses yet</p>
                <p className="text-sm text-muted">Add them so they count in your profit and loss. Cash taken out and your own use are left out.</p>
              </div>
              <form action={addToExpenses}><input type="hidden" name="month" value={m} /><button className={buttonClass("primary")}>Add them to expenses</button></form>
            </Card>
          )}
        </>
      )}

      <SectionTitle>All lines</SectionTitle>
      <form className="mb-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="m" value={m} />
        <select name="dir" defaultValue={dir ?? ""} aria-label="In or out" className="h-9 rounded-lg border border-line bg-card px-2.5 text-sm shadow-sm"><option value="">In and out</option><option value="IN">Money in</option><option value="OUT">Money out</option></select>
        <select name="cat" defaultValue={cat} aria-label="Group" className="h-9 max-w-52 rounded-lg border border-line bg-card px-2.5 text-sm shadow-sm"><option value="">All groups</option>{allCats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <input name="q" defaultValue={q} placeholder="Search the description" aria-label="Search" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-sm shadow-sm sm:max-w-64" />
        <button className={buttonClass("secondary")}>Filter</button>
      </form>
      {txns.length === 0 ? (
        <Card className="text-sm text-muted">No lines match.</Card>
      ) : (
        <Card className="divide-y divide-line p-0 sm:p-0">
          {txns.map((t) => {
            const kind = kindOf(t.category);
            const linked = !!t.expenseId || !!t.entryId;
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="w-14 shrink-0 text-xs text-muted">{fmtDay(t.date)}</div>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium" title={t.description}>{t.description}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {t.counterparty && <span>{t.counterparty}</span>}
                    {t.expenseId && <Badge tone="good">In your expenses</Badge>}
                    {t.entryId && <Badge tone="good">Customer payment</Badge>}
                    {kind === "transfer" && <Badge>Not counted</Badge>}
                  </p>
                </div>
                <div className="basis-48">
                  {manage && !linked ? <CategorySelect id={t.id} value={t.category} options={categoriesFor(t.direction as "IN" | "OUT").map((c) => c.name)} /> : <span className="text-sm text-muted">{categoryInfo(t.category) ? t.category : t.category}</span>}
                </div>
                <div className={`w-28 text-right text-sm font-semibold tabular-nums ${t.direction === "IN" ? "text-got" : "text-gave"}`}>{t.direction === "IN" ? "+" : "−"}{formatINR(t.amountPaise)}</div>
                <div className="w-44 text-right">{manage && !linked && kind !== "transfer" && <TxnActions id={t.id} direction={t.direction as "IN" | "OUT"} parties={parties} suggestion={suggest(t.counterparty)} />}</div>
              </div>
            );
          })}
        </Card>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {pages} · {total} lines</span>
          <span className="flex gap-2">
            {page > 1 && <Link className="rounded-lg border border-line bg-card px-3 py-1.5 shadow-sm hover:bg-bg" href={href({ page: page - 1 })}>Previous</Link>}
            {page < pages && <Link className="rounded-lg border border-line bg-card px-3 py-1.5 shadow-sm hover:bg-bg" href={href({ page: page + 1 })}>Next</Link>}
          </span>
        </div>
      )}

      <SectionTitle>Statements you added</SectionTitle>
      <Card className="divide-y divide-line p-0 sm:p-0">
        {statements.map((st) => (
          <div key={st.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">{st.name}</span>
              <span className="text-xs text-muted">{st.fromDate ? fmtDay(st.fromDate) : ""} to {st.toDate ? fmtDay(st.toDate) : ""} · {st.imported} added{st.duplicates ? ` · ${st.duplicates} skipped as repeats` : ""}</span>
            </span>
            {manage && (
              <form action={deleteStatement}>
                <input type="hidden" name="id" value={st.id} />
                <button className="text-sm text-muted underline hover:text-gave" title="Removes these lines from Money in & out. Expenses and payments already made from them stay.">Remove</button>
              </form>
            )}
          </div>
        ))}
      </Card>
    </>
  );
}
