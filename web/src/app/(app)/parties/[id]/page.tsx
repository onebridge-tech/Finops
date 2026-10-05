import { notFound } from "next/navigation";
import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { partyLedger } from "@/lib/queries";
import { reversedIds, withRunningBalance } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { appUrl, whatsappLink } from "@/lib/share";
import { renderMessage } from "@/lib/messaging/templates";
import { blockedReason } from "@/lib/messaging/send";
import { describeRule, effectiveRule } from "@/lib/reminder-rule";
import { PAYMENT_MODE_LABEL, type PaymentMode } from "@/lib/format";
import { reverseEntry } from "@/app/actions/ledger";
import { setDisputed, updateConsent } from "@/app/actions/messaging";
import { Balance, Card, PageHeader, fmtDate, todayIST } from "@/components/ui";
import { EntryForm } from "./entry-form";
import { ReminderButton, CopyLink } from "./reminder";
import { PartyReminderForm, SendMessageForm } from "./messaging";
import { AttachToEntry } from "./attach";
import { Attachments } from "@/components/attachments";

const CHANNEL_NAME: Record<string, string> = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email", WHATSAPP_LINK: "WhatsApp (own phone)" };
const STATUS_TONE: Record<string, string> = { DELIVERED: "text-got", READ: "text-got", SENT: "text-muted", QUEUED: "text-muted", FAILED: "text-gave", SKIPPED: "text-gave" };

export default async function PartyPage({ params }: PageProps<"/parties/[id]">) {
  const { id } = await params;
  const { business, role } = await requireBusiness();
  const data = await partyLedger(business.id, id);
  if (!data) notFound();
  const { party, entries, balance, overdue } = data;

  const [invoices, messages, receipts, files] = await Promise.all([
    db.invoice.findMany({ where: { partyId: id, businessId: business.id }, orderBy: { date: "desc" }, take: 10 }),
    db.message.findMany({ where: { partyId: id, businessId: business.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.receipt.findMany({ where: { partyId: id, businessId: business.id }, select: { entryId: true, number: true, shareToken: true } }),
    db.storedFile.findMany({ where: { businessId: business.id, entryId: { in: entries.map((e) => e.id) } }, orderBy: { createdAt: "asc" } }),
  ]);
  const filesByEntry = Map.groupBy(files, (f) => f.entryId!);
  const receiptByEntry = new Map(receipts.map((r) => [r.entryId, r]));

  const rows = withRunningBalance(entries).reverse();
  const struck = reversedIds(entries);
  const statementUrl = appUrl(`/s/${party.shareToken}`);
  const reminder = renderMessage("REMINDER", party.language, { party: party.name, business: business.name, balancePaise: balance, link: statementUrl });
  const wa = party.phone ? whatsappLink(party.phone, reminder) : null;
  const blocked = { WHATSAPP: blockedReason(party, "WHATSAPP"), SMS: blockedReason(party, "SMS"), EMAIL: blockedReason(party, "EMAIL") };
  const canMessage = Object.values(blocked).some((b) => !b);
  const optedOut = [party.whatsappOptOutAt && "WhatsApp", party.smsOptOutAt && "SMS", party.emailOptOutAt && "email"].filter(Boolean);
  const rule = effectiveRule(business, party);

  return (
    <>
      <PageHeader
        title={party.name}
        sub={[party.phone && `+${party.phone}`, party.gstin, party.creditDays && `${party.creditDays} days credit`].filter(Boolean).join(" · ") || undefined}
        action={
          <div className="flex flex-wrap gap-2">
            <CopyLink url={statementUrl} label="Copy statement link" />
            {balance > 0 && can(role, "reminder:send") && <ReminderButton partyId={party.id} href={wa} text={reminder} />}
            {can(role, "invoice:write") && (
              <>
                <Link href={`/quotes/new?party=${party.id}`} className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium hover:bg-bg">New quotation</Link>
                <Link href={`/invoices/new?party=${party.id}`} className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium hover:bg-bg">New invoice</Link>
              </>
            )}
          </div>
        }
      />

      {party.disputedAt && (
        <Card className="mb-4 border-gave/40 bg-gave/5 text-sm">
          Marked as disputed on {fmtDate(party.disputedAt)}. Automatic reminders are paused.
        </Card>
      )}

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
        <Card className="mt-4">
          <EntryForm
            partyId={party.id}
            today={todayIST()}
            isSupplier={party.type === "SUPPLIER"}
            canNotify={canMessage}
            notifyDefault={business.entryConfirm}
            autoReceipt={business.autoReceipt}
          />
        </Card>
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
                const receipt = receiptByEntry.get(e.id);
                return (
                  <tr key={e.id} className={cancelled ? "text-muted line-through" : ""}>
                    <td className="whitespace-nowrap px-4 py-2">{fmtDate(e.date)}</td>
                    <td className="px-4 py-2">
                      {e.note ?? "—"}
                      {e.dueDate && e.direction === "GAVE" && !cancelled && <span className="block text-xs text-muted no-underline">Due {fmtDate(e.dueDate)}</span>}
                      <Attachments files={filesByEntry.get(e.id) ?? []} />
                      {e.paymentMode && (
                        <span className="block text-xs text-muted">
                          {PAYMENT_MODE_LABEL[e.paymentMode as PaymentMode] ?? e.paymentMode}
                          {receipt && <> · <a href={`/r/${receipt.shareToken}`} target="_blank" className="underline">Receipt {receipt.number}</a></>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gave">{e.direction === "GAVE" ? formatINR(e.amountPaise) : ""}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-got">{e.direction === "GOT" ? formatINR(e.amountPaise) : ""}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatINR(e.running)}</td>
                    <td className="space-y-1 px-2 py-2 text-right">
                      {can(role, "ledger:write") && <AttachToEntry entryId={e.id} />}
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
        <section className="space-y-3">
          <h2 className="font-semibold">Messages</h2>
          <Card className="space-y-3 text-sm">
            <ConsentStatus partyId={party.id} consentAt={party.consentAt} optedOut={optedOut as string[]} editable={can(role, "party:write")} />
            {can(role, "reminder:send") && (
              <SendMessageForm partyId={party.id} blocked={blocked} canRemind={balance > 0} />
            )}
          </Card>
          {can(role, "party:write") && (
            <Card className="space-y-3 text-sm">
              <PartyReminderForm
                partyId={party.id}
                businessRule={describeRule(effectiveRule(business, { ...party, reminderMode: "DEFAULT" }))}
                rule={{
                  mode: party.reminderMode,
                  daysBefore: party.reminderDaysBefore ?? business.reminderDaysBefore,
                  onDue: party.reminderOnDue ?? business.reminderOnDue,
                  everyDaysAfter: party.reminderEveryDaysAfter ?? business.reminderEveryDaysAfter,
                  channel: party.reminderChannel ?? business.reminderChannel,
                }}
              />
              <p className="text-xs text-muted">Now: {describeRule(rule)}{party.lastAutoReminderAt && ` · last sent ${fmtDate(party.lastAutoReminderAt)}`}</p>
              <form action={setDisputed}>
                <input type="hidden" name="partyId" value={party.id} />
                <input type="hidden" name="disputed" value={party.disputedAt ? "0" : "1"} />
                <button className="text-xs text-muted underline hover:text-ink">
                  {party.disputedAt ? "Dispute resolved — resume reminders" : "Mark as disputed (pause reminders)"}
                </button>
              </form>
            </Card>
          )}
        </section>
        <section className="space-y-6">
          <div>
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
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Message history</h2>
            <Card className="divide-y divide-line p-0 text-sm">
              {messages.length === 0 && <p className="px-4 py-3 text-muted">None yet.</p>}
              {messages.map((m) => (
                <div key={m.id} className="px-4 py-3">
                  <p className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="text-muted">{fmtDate(m.createdAt)} · {CHANNEL_NAME[m.channel] ?? m.channel} · {m.kind.toLowerCase().replace("_", " ")}{m.trigger !== "MANUAL" && ` · ${m.trigger.toLowerCase()}`}{m.provider === "test" && " · test mode"}</span>
                    <span className={STATUS_TONE[m.status] ?? "text-muted"}>{m.status.toLowerCase()}{m.error && `: ${m.error}`}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line">{m.body}</p>
                </div>
              ))}
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}

function ConsentStatus({ partyId, consentAt, optedOut, editable }: { partyId: string; consentAt: Date | null; optedOut: string[]; editable: boolean }) {
  if (!consentAt) {
    return (
      <p className="text-muted">
        No messaging consent recorded, so the app won’t message this party.{" "}
        {editable && <ConsentButton partyId={partyId} action="grant">They agreed — record consent</ConsentButton>}
      </p>
    );
  }
  return (
    <p className="text-muted">
      Consent recorded {fmtDate(consentAt)}.
      {optedOut.length > 0 && <> Opted out of {optedOut.join(", ")}. {editable && <ConsentButton partyId={partyId} action="optin">They asked to resume</ConsentButton>}</>}
      {optedOut.length === 0 && editable && <> <ConsentButton partyId={partyId} action="optout">They asked to stop all messages</ConsentButton></>}
    </p>
  );
}

function ConsentButton({ partyId, action, children }: { partyId: string; action: string; children: string }) {
  return (
    <form action={updateConsent} className="inline">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="channel" value="ALL" />
      <button className="text-xs underline hover:text-ink">{children}</button>
    </form>
  );
}
