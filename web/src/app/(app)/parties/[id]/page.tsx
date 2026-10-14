import { notFound } from "next/navigation";
import Link from "next/link";
import { can, requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { partyLedger } from "@/lib/queries";
import { istDay, openDues, reversedIds, withRunningBalance } from "@/lib/ledger";
import { promiseStatus } from "@/lib/rules";
import { formatINR } from "@/lib/money";
import { appUrl, whatsappLink } from "@/lib/share";
import { renderMessage } from "@/lib/messaging/templates";
import { blockedReason } from "@/lib/messaging/send";
import { describeRule, effectiveRule } from "@/lib/reminder-rule";
import { PAYMENT_MODE_LABEL, type PaymentMode } from "@/lib/format";
import { reverseEntry } from "@/app/actions/ledger";
import { setDisputed, updateConsent } from "@/app/actions/messaging";
import { Avatar, Balance, Card, PageHeader, buttonClass, fmtDate, todayIST } from "@/components/ui";
import { EntryForm } from "./entry-form";
import { ReminderButton, CopyLink } from "./reminder";
import { PartyReminderForm, SendMessageForm } from "./messaging";
import { AttachToEntry } from "./attach";
import { Attachments } from "@/components/attachments";
import { AddFollowUpForm, CompleteFollowUp } from "@/components/follow-up-forms";
import { teamOptions } from "@/lib/team";
import { PromiseForm } from "@/components/promise-form";
import { translator } from "@/lib/i18n";
import { drCr, ledgerGroup, voucherType } from "@/lib/accounting";
import { convertLead } from "@/app/actions/ledger";

const CHANNEL_NAME: Record<string, string> = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email", WHATSAPP_LINK: "WhatsApp (own phone)" };
const STATUS_TONE: Record<string, string> = { DELIVERED: "text-got", READ: "text-got", SENT: "text-muted", QUEUED: "text-muted", FAILED: "text-gave", SKIPPED: "text-gave" };

export const metadata = { title: "Customer account" };

export default async function PartyPage({ params }: PageProps<"/parties/[id]">) {
  const { id } = await params;
  const ctx = await requireBusiness();
  const { business, role } = ctx;
  const data = await partyLedger(ctx, id);
  if (!data) notFound();
  const { party, entries, allocations, balance, overdue } = data;
  const dues = openDues(entries, allocations);
  const openById = new Map(dues.map((d) => [d.id, d.open]));
  const openBills = dues.map((d) => {
    const e = entries.find((x) => x.id === d.id)!;
    return { id: d.id, label: (e.note ?? "Credit") + " · " + fmtDate(e.date), due: fmtDate(d.due), open: formatINR(d.open), openPaise: d.open };
  });

  const [invoices, messages, receipts, files] = await Promise.all([
    db.invoice.findMany({ where: { partyId: id, businessId: business.id }, orderBy: { date: "desc" }, take: 10 }),
    db.message.findMany({ where: { partyId: id, businessId: business.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.receipt.findMany({ where: { partyId: id, businessId: business.id }, select: { entryId: true, number: true, shareToken: true } }),
    db.storedFile.findMany({ where: { businessId: business.id, entryId: { in: entries.map((e) => e.id) } }, orderBy: { createdAt: "asc" } }),
  ]);
  const filesByEntry = Map.groupBy(files, (f) => f.entryId!);
  const promises = await db.promiseToPay.findMany({ where: { partyId: id, businessId: business.id }, orderBy: { createdAt: "desc" }, take: 8 });
  const cancelledIds = reversedIds(entries);
  const liveEntries = entries.filter((e) => !cancelledIds.has(e.id));
  const [followUps, team] = await Promise.all([
    db.followUp.findMany({ where: { partyId: id, businessId: business.id }, orderBy: [{ doneAt: { sort: "desc", nulls: "first" } }, { dueAt: "asc" }], take: 15 }),
    ctx.assignedOnly ? null : teamOptions(business.id),
  ]);
  const teamName = new Map((team ?? []).map((t) => [t.id, t.name]));
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
  const t = translator(ctx.user.uiLanguage);
  const accountant = ctx.user.uiMode === "ACCOUNTANT";
  const btn = buttonClass("secondary");

  return (
    <>
      <PageHeader
        leading={<Avatar name={party.name} size={44} />}
        title={party.name}
        sub={[accountant ? ledgerGroup(party.type, balance) : party.type === "LEAD" ? t("type.LEAD") : null, party.phone && `+${party.phone}`, party.gstin, party.creditDays && `${party.creditDays} days credit`].filter(Boolean).join(" · ") || undefined}
        action={
          <div className="flex flex-wrap gap-2">
            {party.type === "LEAD" && can(role, "party:write") && (
              <form action={convertLead}><input type="hidden" name="partyId" value={party.id} /><button className={buttonClass("primary")}>{t("party.makeCustomer")}</button></form>
            )}
            {can(role, "party:write") && <Link href={`/parties/${party.id}/edit`} className={btn}>{t("party.edit")}</Link>}
            <CopyLink url={statementUrl} label={t("party.copyStatement")} />
            {balance > 0 && can(role, "reminder:send") && <ReminderButton partyId={party.id} href={wa} text={reminder} label={t("party.remind")} />}
            {can(role, "invoice:write") && (
              <>
                <Link href={`/quotes/new?party=${party.id}`} className={btn}>{t("party.newQuote")}</Link>
                {party.type !== "LEAD" && <Link href={`/invoices/new?party=${party.id}`} className={btn}>{t("party.newInvoice")}</Link>}
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

      <div className={"grid gap-3 " + (party.creditLimitPaise !== null ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        <Card>
          <p className="text-[13px] font-medium text-muted">{t("party.balance")}</p>
          <Balance paise={balance} className="mt-2 block text-2xl" t={t} accountant={accountant} />
        </Card>
        <Card>
          <p className="text-[13px] font-medium text-muted">{t("party.overdue")}</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${overdue > 0 ? "text-gave" : "text-muted"}`}>{formatINR(overdue)}</p>
        </Card>
        {party.creditLimitPaise !== null && (
          <Card>
            <p className="text-[13px] font-medium text-muted">Credit limit</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatINR(party.creditLimitPaise)}</p>
            <p className={"text-xs " + (balance > Number(party.creditLimitPaise) ? "font-medium text-gave" : "text-muted")}>
              {balance > Number(party.creditLimitPaise) ? "Over by " + formatINR(balance - Number(party.creditLimitPaise)) : formatINR(Number(party.creditLimitPaise) - Math.max(balance, 0)) + " available"}
            </p>
          </Card>
        )}
      </div>

      {can(role, "ledger:write") && party.type !== "LEAD" && (
        <Card className="mt-4">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Write an entry</h2>
          <EntryForm
            partyId={party.id}
            today={todayIST()}
            isSupplier={party.type === "SUPPLIER"}
            canNotify={canMessage}
            notifyDefault={business.entryConfirm}
            autoReceipt={business.autoReceipt}
            openBills={openBills}
          />
        </Card>
      )}

      <h2 className="mb-3 mt-8 text-base font-semibold tracking-tight">{accountant ? "Ledger" : t("party.entries")}</h2>
      {rows.length === 0 ? (
        <Card className="text-sm text-muted">{t("party.noEntries")}</Card>
      ) : (
        <Card className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-line bg-bg/50 text-left text-xs font-medium text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">{t("col.date")}</th>
                {accountant && <th className="px-4 py-2 font-medium">Voucher</th>}
                <th className="px-4 py-2 font-medium">{accountant ? "Particulars" : t("col.details")}</th>
                <th className="px-4 py-2 text-right font-medium">{accountant ? "Debit" : t("col.gave")}</th>
                <th className="px-4 py-2 text-right font-medium">{accountant ? "Credit" : t("col.got")}</th>
                <th className="px-4 py-2 text-right font-medium">{t("col.balance")}</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((e) => {
                const cancelled = struck.has(e.id);
                const receipt = receiptByEntry.get(e.id);
                return (
                  <tr key={e.id} className={`align-top transition hover:bg-bg/60 ${cancelled ? "text-muted line-through" : ""}`}>
                    <td className="whitespace-nowrap px-4 py-2">{fmtDate(e.date)}</td>
                    {accountant && <td className="whitespace-nowrap px-4 py-2 text-xs">{voucherType(e, party.type)}{receipt ? ` · ${receipt.number}` : ""}</td>}
                    <td className="px-4 py-2">
                      {e.note ?? "—"}
                      {e.dueDate && e.direction === "GAVE" && !cancelled && <span className="block text-xs text-muted no-underline">Due {fmtDate(e.dueDate)}</span>}
                      {e.direction === "GAVE" && !cancelled && e.source !== "REVERSAL" && (
                        <span className={"block text-xs no-underline " + (openById.has(e.id) ? (openById.get(e.id)! < Number(e.amountPaise) ? "text-gave" : "text-muted") : "text-got")}>
                          {openById.has(e.id) ? (openById.get(e.id)! < Number(e.amountPaise) ? "Part-paid · " + formatINR(openById.get(e.id)!) + " open" : "Unpaid") : "Paid"}
                        </span>
                      )}
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
                    <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{accountant ? drCr(e.running) : formatINR(e.running)}</td>
                    <td className="space-y-1 px-2 py-2 text-right">
                      {can(role, "ledger:write") && <AttachToEntry entryId={e.id} />}
                      {!cancelled && (e.source === "MANUAL" || e.source === "OPENING") && can(role, "ledger:reverse") && (
                        <form action={reverseEntry}>
                          <input type="hidden" name="entryId" value={e.id} />
                          <button className="text-xs text-muted hover:text-gave" title="Undo this entry">{t("entry.reverse")}</button>
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
        {balance > 0 && can(role, "party:write") && (
          <section className="space-y-3 lg:col-span-2">
            <h2 className="text-base font-semibold tracking-tight">Promises to pay</h2>
            <Card className="space-y-3 text-sm">
              <PromiseForm partyId={party.id} today={todayIST()} />
              {promises.length > 0 && (
                <ul className="divide-y divide-line border-t border-line">
                  {promises.map((p) => {
                    const received = liveEntries.filter((e) => e.direction === "GOT" && e.createdAt > p.createdAt).reduce((s, e) => s + Number(e.amountPaise), 0);
                    const st = promiseStatus({ promisedFor: p.promisedFor, amountPaise: p.amountPaise === null ? null : Number(p.amountPaise), receivedSince: received, balanceNow: balance, today: new Date(), istDay });
                    return (
                      <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                        <span>
                          {fmtDate(p.promisedFor)}
                          {p.amountPaise !== null && " · " + formatINR(p.amountPaise)}
                          {p.note && <span className="text-muted"> · {p.note}</span>}
                        </span>
                        <span className={"text-xs font-medium " + (st === "KEPT" ? "text-got" : st === "BROKEN" ? "text-gave" : "text-muted")}>
                          {st === "KEPT" ? "Kept" : st === "BROKEN" ? "Not kept" : "Waiting"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
        )}
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-semibold tracking-tight">{t("party.followUps")}</h2>
          <Card className="space-y-3 text-sm">
            {can(role, "party:write") && <AddFollowUpForm partyId={party.id} today={todayIST()} team={team} />}
            {followUps.length > 0 && (
              <ul className="divide-y divide-line border-t border-line">
                {followUps.map((f) => {
                  const late = !f.doneAt && f.dueAt < new Date();
                  return (
                    <li key={f.id} className="py-2">
                      <p className="flex flex-wrap justify-between gap-2">
                        <span className={f.doneAt ? "text-muted line-through" : ""}>{f.note}</span>
                        <span className={`text-xs ${late ? "font-medium text-gave" : "text-muted"}`}>
                          {f.doneAt ? `done ${fmtDate(f.doneAt)}` : `${late ? "overdue · " : ""}${fmtDate(f.dueAt)}`}
                          {teamName.get(f.assignedToId) && ` · ${teamName.get(f.assignedToId)}`}
                        </span>
                      </p>
                      {f.outcome && <p className="text-xs text-muted">Outcome: {f.outcome}</p>}
                      {!f.doneAt && can(role, "party:write") && <CompleteFollowUp id={f.id} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">{t("party.messages")}</h2>
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
            <h2 className="mb-3 text-base font-semibold tracking-tight">{t("party.invoices")}</h2>
            <Card className="divide-y divide-line p-0 text-sm">
              {invoices.length === 0 && <p className="px-4 py-3 text-muted">No bills.</p>}
              {invoices.map((i) => (
                <Link key={i.id} href={`/invoices/${i.id}`} className="flex justify-between px-4 py-3 hover:bg-bg">
                  <span>{i.number} · {fmtDate(i.date)}</span>
                  <span className="tabular-nums">{formatINR(i.totalPaise)}</span>
                </Link>
              ))}
            </Card>
          </div>
          <div>
            <h2 className="mb-3 text-base font-semibold tracking-tight">{t("party.history")}</h2>
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
      <div className="text-muted">
        No messaging consent recorded, so the app won’t message this party.{" "}
        {editable && <ConsentButton partyId={partyId} action="grant">They agreed — record consent</ConsentButton>}
      </div>
    );
  }
  return (
    <div className="text-muted">
      Consent recorded {fmtDate(consentAt)}.
      {optedOut.length > 0 && <> Opted out of {optedOut.join(", ")}. {editable && <ConsentButton partyId={partyId} action="optin">They asked to resume</ConsentButton>}</>}
      {optedOut.length === 0 && editable && <> <ConsentButton partyId={partyId} action="optout">They asked to stop all messages</ConsentButton></>}
    </div>
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
