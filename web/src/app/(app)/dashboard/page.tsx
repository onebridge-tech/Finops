import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { dashboard } from "@/lib/queries";
import { formatINR } from "@/lib/money";
import { Card, EmptyState, LinkButton, PageHeader, fmtDate } from "@/components/ui";

export const metadata = { title: "Home" };

export default async function Dashboard() {
  const { business } = await requireBusiness();
  const d = await dashboard(business.id);

  return (
    <>
      <PageHeader
        title="Today"
        sub={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" })}
        action={
          <div className="flex gap-2">
            <LinkButton href="/parties/new" variant="secondary">Add party</LinkButton>
            <LinkButton href="/invoices/new">New invoice</LinkButton>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="To collect" value={formatINR(d.toCollect)} tone="gave" />
        <Stat label="Overdue" value={formatINR(d.overdueTotal)} tone="gave" />
        <Stat label="To pay" value={formatINR(d.toPay)} tone="got" />
        <Stat label="Collected today" value={formatINR(d.todayGot)} hint={`Credit given today ${formatINR(d.todayGave)}`} />
      </div>

      {!business.upiId && (
        <Card className="mt-4 border-brand/40 bg-brand/5 text-sm">
          Add your UPI ID in <Link href="/settings" className="font-medium text-brand underline">Settings</Link> so customers can pay from reminders and invoices.
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Top overdue</h2>
          {d.overdue.length === 0 ? (
            <EmptyState title="Nothing overdue">{d.partyCount === 0 ? "Add your first customer to start tracking credit." : "All dues are within their credit period."}</EmptyState>
          ) : (
            <Card className="divide-y divide-line p-0">
              {d.overdue.map((p) => (
                <Link key={p.id} href={`/parties/${p.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-bg">
                  <span className="truncate">{p.name}</span>
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums text-gave">{formatINR(p.overdue)}</span>
                    <span className="text-xs text-muted">of {formatINR(p.balance)} due</span>
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Recent activity</h2>
          {d.recent.length === 0 ? (
            <EmptyState title="No entries yet" />
          ) : (
            <Card className="divide-y divide-line p-0">
              {d.recent.map((e) => (
                <Link key={e.id} href={`/parties/${e.partyId}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-bg">
                  <span>
                    <span className="block font-medium">{e.party.name}</span>
                    <span className="text-xs text-muted">{fmtDate(e.date)} · {e.note ?? (e.direction === "GAVE" ? "You gave" : "You got")}</span>
                  </span>
                  <span className={`font-semibold tabular-nums ${e.direction === "GAVE" ? "text-gave" : "text-got"}`}>
                    {formatINR(e.amountPaise)} <span className="text-xs font-normal">{e.direction === "GAVE" ? "gave" : "got"}</span>
                  </span>
                </Link>
              ))}
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "gave" | "got" }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "gave" ? "text-gave" : tone === "got" ? "text-got" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
