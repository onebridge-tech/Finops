import Link from "next/link";
import { PAGE_SIZE, usersList } from "@/lib/platform";
import { userLabel } from "@/lib/identity";
import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icon";
import { since } from "../bars";

export const metadata = { title: "Users · Platform admin" };
export const dynamic = "force-dynamic";

export default async function Users({ searchParams }: PageProps<"/platform/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const { total, rows } = await usersList({ q, page });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => `/platform/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="People" sub={`${total} ${total === 1 ? "person" : "people"} have signed up`} />
      <form className="relative mb-4 w-full sm:w-80">
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} placeholder="Name, phone or email" aria-label="Search people" className="h-10 w-full rounded-lg border border-line bg-card pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-muted/70 focus:border-brand focus:ring-2 focus:ring-brand/20" />
      </form>

      {rows.length === 0 ? (
        <EmptyState icon="users" title={q ? "No one matches that" : "No one yet"} />
      ) : (
        <Card className="divide-y divide-line p-0 sm:p-0">
          {rows.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar name={userLabel(u)} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{userLabel(u)}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  {u.phone && <span>+{u.phone}</span>}{u.email && <span>{u.email}</span>}{u.google && <Badge tone="brand">Google</Badge>}
                </span>
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {u.shops.length === 0 && <span className="text-xs text-muted">No shop yet</span>}
                  {u.shops.map((s) => <Link key={s.id} href={`/platform/shops/${s.id}`} className="rounded-md bg-bg px-2 py-0.5 text-xs hover:underline">{s.name} · {s.role.toLowerCase()}</Link>)}
                </span>
              </span>
              <span className="text-right text-xs text-muted">
                <span className="block">Joined {u.createdAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</span>
                <span className="block">Active {since(u.lastActive)}</span>
              </span>
            </div>
          ))}
        </Card>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {pages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link className="rounded-lg border border-line bg-card px-3 py-1.5 shadow-sm hover:bg-bg" href={href(page - 1)}>Previous</Link>}
            {page < pages && <Link className="rounded-lg border border-line bg-card px-3 py-1.5 shadow-sm hover:bg-bg" href={href(page + 1)}>Next</Link>}
          </span>
        </div>
      )}
    </>
  );
}
