import { notFound } from "next/navigation";
import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { partyLedger } from "@/lib/queries";
import { reversedIds, withRunningBalance } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { appUrl, reminderText, whatsappLink } from "@/lib/share";
import { reverseEntry } from "@/app/actions/ledger";
import { Balance, Card, PageHeader, fmtDate, todayIST } from "@/components/ui";
import { EntryForm } from "./entry-form";
import { ReminderButton, CopyLink } from "./reminder";

export default async function PartyPage({ params }: PageProps<"/parties/[id]">) {
  const { id } = await params;
  const { business, role } = await requireBusiness();
  const data = await partyLedger(business.id, id);
  if (!data) notFound();
  const { party, entries, balance, overdue } = data;

  const [invoices, messages] = await Promise.all([
    db.invoice.findMany({ where: { partyId: id, businessId: business.id }, orderBy: { date: "desc" }, take: 10 }),
    db.message.findMany({ where: { partyId: id, businessId: business.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  const rows = withRunningBalance(entries).reverse();
  const struck = reversedIds(entries);
  const statementUrl = appUrl(`/s/${party.shareToken}`);
  const reminder = reminderText(party.language, { party: party.name, business: business.name, amountPaise: balance, link: statementUrl });
  const wa = party.phone ? whatsappLink(party.phone, reminder) : null;

  return (
    <>
      <PageHeader
        title={party.name}
        sub={[party.phone && `+${party.phone}`, party.gstin, party.creditDays && `${party.creditDays} days credit`].filter(Boolean).join(" · ") || undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <CopyLink url={statementUrl} />
            {balance > 0 && can(role, "reminder:send") && <ReminderButton partyId={party.id} href={wa} text={reminder} />}
            {can(role, "invoice:write") && (
              <Link href={`/invoices/new?party=${party.id}`} className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium hover:bg-bg">New invoice</Link>
            )}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-muted">Balance</p>
          <Balance paise={balance} className="mt-1 block text-2xl" />
        </Card>
        <Card>
          <p className="text-sm text-muted">Overdue</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${overdue > 0 ? "text-gave" : "text-muted"}`}>{formatINR(overdue)}</p>
        </Card>
      </div>

      {can(role, "ledger:write") && (
        <Card className="mt-4"><EntryForm partyId={party.id} today={todayIST()} /></Card>
      )}

      <h2 className="mb-2 mt-6 font-semibold">Entries</h2>
      {rows.length === 0 ? (
        <Card className="text-sm text-muted">No entries yet.</Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Details</th>
                <th className="px-4 py-2 text-right font-medium">You gave</th>
                <th className="px-4 py-2 text-right font-medium">You got</th>
                <th className="px-4 py-2 text-right font-medium">Balance</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const cancelled = struck.has(e.id);
                return (
                  <tr key={e.id} className={cancelled ? "text-muted line-through" : ""}>
                    <td className="whitespace-nowrap px-4 py-2">{fmtDate(e.date)}</td>
                    <td className="px-4 py-2">
                      {e.note ?? "—"}
                      {e.dueDate && e.direction === "GAVE" && !cancelled && <span className="block text-xs text-muted no-underline">Due {fmtDate(e.dueDate)}</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gave">{e.direction === "GAVE" ? formatINR(e.amountPaise) : ""}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-got">{e.direction === "GOT" ? formatINR(e.amountPaise) : ""}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatINR(e.running)}</td>
                    <td className="px-2 py-2 text-right">
                      {!cancelled && (e.source === "MANUAL" || e.source === "OPENING") && can(role, "ledger:reverse") && (
                        <form action={reverseEntry}>
                          <input type="hidden" name="entryId" value={e.id} />
                          <button className="text-xs text-muted hover:text-gave" title="Post a reversal entry">Reverse</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">Invoices</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {invoices.length === 0 && <p className="px-4 py-3 text-muted">No invoices.</p>}
            {invoices.map((i) => (
              <Link key={i.id} href={`/invoices/${i.id}`} className="flex justify-between px-4 py-3 hover:bg-bg">
                <span>{i.number} · {fmtDate(i.date)}</span>
                <span className="tabular-nums">{formatINR(i.totalPaise)}</span>
              </Link>
            ))}
          </Card>
        </section>
        <section>
          <h2 className="mb-2 font-semibold">Reminders sent</h2>
          <Card className="divide-y divide-line p-0 text-sm">
            {messages.length === 0 && <p className="px-4 py-3 text-muted">None yet.</p>}
            {messages.map((m) => (
              <p key={m.id} className="px-4 py-3"><span className="text-muted">{fmtDate(m.createdAt)} · WhatsApp</span><span className="mt-1 block">{m.body}</span></p>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
