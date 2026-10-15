import Link from "next/link";
import { errorsList } from "@/lib/platform-insights";
import { reopenError, resolveError } from "@/app/actions/platform";
import { Badge, buttonClass, Card, EmptyState, PageHeader } from "@/components/ui";
import { since } from "../bars";

export const metadata = { title: "Errors · Platform admin" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { SERVER: "Page", ACTION: "Button or form", ROUTE: "Background or API", CLIENT: "In the browser" };

export default async function Errors({ searchParams }: PageProps<"/platform/errors">) {
  const sp = await searchParams;
  const view = sp.view === "resolved" ? "resolved" : "open";
  const { rows, openCount } = await errorsList(view);

  return (
    <>
      <PageHeader
        title="Errors"
        sub={`${openCount} open. The same problem is one line with a count. Nothing a person typed is stored.`}
        action={<a href="/platform/errors/crash" className={buttonClass("secondary")}>Send a test crash</a>}
      />
      <nav className="mb-5 flex w-fit gap-1 rounded-lg bg-line/50 p-1" aria-label="Filter">
        {(["open", "resolved"] as const).map((v) => (
          <Link key={v} href={`/platform/errors?view=${v}`} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${view === v ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>{v === "open" ? "Open" : "Resolved"}</Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState icon="check" title={view === "open" ? "No open errors" : "Nothing resolved yet"}>{view === "open" ? "Nothing has gone wrong that we know of." : undefined}</EmptyState>
      ) : (
        <Card className="divide-y divide-line p-0 sm:p-0">
          {rows.map((e) => (
            <div key={e.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2"><Badge tone={e.kind === "CLIENT" ? "warn" : "bad"}>{KIND[e.kind] ?? e.kind}</Badge><span className="font-mono text-xs text-muted">{e.method ? `${e.method} ` : ""}{e.route}</span></span>
                  <span className="mt-1.5 block break-words font-medium">{e.message}</span>
                  <span className="mt-1 block text-xs text-muted">Seen {e.count} time{e.count === 1 ? "" : "s"} · last {since(e.lastSeenAt)} · first {since(e.firstSeenAt)}{e.digest ? ` · ref ${e.digest}` : ""}</span>
                  {e.stack && <details className="mt-2"><summary className="cursor-pointer text-xs text-brand">Show where it happened</summary><pre className="mt-1 overflow-x-auto rounded-lg bg-bg p-2 text-[11px] leading-snug">{e.stack}</pre></details>}
                </span>
                <form action={view === "open" ? resolveError : reopenError}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className={buttonClass("secondary")}>{view === "open" ? "Mark resolved" : "Reopen"}</button>
                </form>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
