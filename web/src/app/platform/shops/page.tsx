import Link from "next/link";
import { PAGE_SIZE, shopsList } from "@/lib/platform";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { since } from "../bars";

export const metadata = { title: "Shops · Platform admin" };
export const dynamic = "force-dynamic";

const SORTS = [["new", "Newest"], ["active", "Recently active"], ["busy", "Busiest"], ["name", "Name"]] as const;

export default async function Shops({ searchParams }: PageProps<"/platform/shops">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const sort = SORTS.find(([s]) => s === sp.sort)?.[0] ?? "new";
  const page = Math.max(1, Number(sp.page) || 1);
  const { total, rows } = await shopsList({ q, sort, page });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (o: Record<string, string | number>) => `/platform/shops?${new URLSearchParams({ ...(q ? { q } : {}), sort, ...Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <>
      <PageHeader title="Shops" sub={`${total} shop${total === 1 ? "" : "s"}`} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-line/50 p-1" aria-label="Sort">
          {SORTS.map(([s, label]) => (
            <Link key={s} href={href({ sort: s, page: 1 })} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${sort === s ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{label}</Link>
          ))}
        </nav>
        <form className="relative w-full sm:w-80">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} placeholder="Shop name, owner phone or email" aria-label="Search shops" className="h-10 w-full rounded-lg border border-line bg-card pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20" />
          <input type="hidden" name="sort" value={sort} />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="shop" title={q ? "No shop matches that" : "No shops yet"} />
      ) : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line bg-bg/50 text-left text-xs font-medium text-muted">
              <tr><th className="px-4 py-2.5">Shop</th><th className="px-4 py-2.5">Owner</th><th className="px-4 py-2.5">Joined</th><th className="px-4 py-2.5">Last active</th><th className="px-4 py-2.5 text-right">Customers</th><th className="px-4 py-2.5 text-right">Bills</th><th className="px-4 py-2.5 text-right">Entries</th><th className="px-4 py-2.5 text-right">Credits</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="transition hover:bg-bg/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/platform/shops/${r.id}`} className="flex items-center gap-2.5 font-medium hover:underline"><Avatar name={r.name} size={30} />{r.name}</Link>
                  </td>
                  <td className="px-4 py-2.5">{r.owner !== "—" && <span className="block">{r.owner}</span>}<span className={r.owner !== "—" ? "text-xs text-muted" : ""}>{r.ownerPhone ? `+${r.ownerPhone}` : r.ownerEmail ?? "—"}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{r.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{since(r.lastActive)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.parties}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.bills}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.entries}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {pages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link className="rounded-lg border border-line bg-card px-3 py-1.5 shadow-sm hover:bg-bg" href={href({ page: page - 1 })}>Previous</Link>}
            {page < pages && <Link className="rounded-lg border border-line bg-card px-3 py-1.5 shadow-sm hover:bg-bg" href={href({ page: page + 1 })}>Next</Link>}
          </span>
        </div>
      )}
    </>
  );
}
