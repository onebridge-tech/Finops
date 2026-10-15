import Link from "next/link";
import { can, partyWhere, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { whatsappLink } from "@/lib/share";
import { removeAllFromOutbox } from "@/app/actions/outbox";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { OutboxRow } from "./outbox-row";

export const metadata = { title: "WhatsApp outbox" };

const KIND: Record<string, string> = {
  REMINDER: "Payment reminder", ENTRY_CONFIRMATION: "Entry confirmation", RECEIPT: "Receipt", INVOICE: "Bill", QUOTE: "Price quote",
  STATEMENT: "Account statement", INVITE: "Invitation", DIGEST: "Your daily summary", ALERT: "Alert for you",
};

export default async function Outbox() {
  const ctx = await requireBusiness("reminder:send");
  const visible = { businessId: ctx.business.id, channel: "WHATSAPP_LINK", OR: [{ party: partyWhere(ctx) }, ...(can(ctx.role, "settings:write") ? [{ partyId: null }] : [])] };
  const [queued, sent] = await Promise.all([
    db.message.findMany({ where: { ...visible, status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: 200, include: { party: { select: { id: true, name: true } } } }),
    db.message.findMany({ where: { ...visible, status: "SENT" }, orderBy: { sentAt: "desc" }, take: 15, include: { party: { select: { id: true, name: true } } } }),
  ]);
  const time = (d: Date) => d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

  return (
    <>
      <PageHeader
        title="WhatsApp outbox"
        sub="Messages written for you from your templates. Tap Send, WhatsApp opens with the words ready, and you press send there."
        action={can(ctx.role, "settings:write") && <Link href="/settings/templates" className="text-sm font-medium text-brand hover:underline">Change the wording</Link>}
      />

      {queued.length === 0 ? (
        <EmptyState icon="send" title="Nothing waiting to be sent">
          Reminders, receipts and bills you ask for appear here. You can also send one straight from a customer’s page.
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-muted">{queued.length} ready to send</p>
            <form action={removeAllFromOutbox}><button className="text-sm text-muted underline hover:text-gave">Clear all</button></form>
          </div>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {queued.map((m) => (
              <OutboxRow
                key={m.id}
                id={m.id}
                name={m.party?.name ?? "You"}
                kind={KIND[m.kind] ?? m.kind.toLowerCase()}
                preview={m.body}
                when={time(m.createdAt)}
                href={whatsappLink(m.to, m.body)}
                partyHref={m.party ? `/parties/${m.party.id}` : null}
              />
            ))}
          </Card>
        </>
      )}

      {sent.length > 0 && (
        <>
          <SectionTitle>Sent recently</SectionTitle>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {sent.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.party?.name ?? "You"}</span>
                  <span className="text-xs text-muted">{KIND[m.kind] ?? m.kind.toLowerCase()} · {m.sentAt ? time(m.sentAt) : ""}</span>
                </span>
                <Badge tone="good">Opened in WhatsApp</Badge>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-xs text-muted">We can’t see inside WhatsApp, so “opened” means you tapped Send. Whether it was delivered or read isn’t known.</p>
        </>
      )}
    </>
  );
}
