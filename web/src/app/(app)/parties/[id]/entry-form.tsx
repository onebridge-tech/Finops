"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState, useEffect, useRef, useState } from "react";
import { addEntry } from "@/app/actions/ledger";
import { ErrorText, Field, Input, Select, buttonClass } from "@/components/ui";
import { PAYMENT_MODES, PAYMENT_MODE_LABEL } from "@/lib/format";
import { AttachmentInput } from "@/components/attachment-input";
import { CreditWarning } from "@/components/credit-warning";
import { useMode, useT } from "@/components/i18n-provider";
import { Icon } from "@/components/icon";

export type OpenBill = { id: string; label: string; due: string | null; open: string; openPaise: number };

type Props = {
  partyId: string;
  today: string;
  isSupplier: boolean;
  canNotify: boolean; // party has consent and a contact
  notifyDefault: boolean;
  autoReceipt: boolean;
  openBills: OpenBill[]; // unpaid bills a receipt can be assigned to (CP-10)
};

export function EntryForm({ partyId, today, isSupplier, canNotify, notifyDefault, autoReceipt, openBills }: Props) {
  const [state, action, pending] = useActionState(addEntry, {});
  const [direction, setDirection] = useState<"GAVE" | "GOT">("GAVE");
  const [mode, setMode] = useState(isSupplier ? "" : "CASH");
  const [settle, setSettle] = useState<"AUTO" | "BILLS">("AUTO");
  const form = useRef<HTMLFormElement>(null);
  const t = useT();
  const accountant = useMode() === "ACCOUNTANT";

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  const receiptGoesOut = direction === "GOT" && mode !== "" && autoReceipt;
  // Paying a supplier ("you gave") records how it was paid, for the cashbook.
  const paymentOut = direction === "GAVE" && isSupplier;

  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="space-y-3" onReset={() => setSettle("AUTO")}>
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="direction" value={direction} />
      <div className="grid grid-cols-2 gap-2">
        {(["GAVE", "GOT"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            aria-pressed={direction === d} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${direction === d ? (d === "GAVE" ? "border-gave bg-gave/10 text-gave" : "border-got bg-got/10 text-got") : "border-line text-muted"}`}
          >
            <Icon name={d === "GAVE" ? "arrowUp" : "arrowDown"} size={18} />{accountant ? (d === "GAVE" ? "Debit (Dr) — party owes more" : "Credit (Cr) — payment / goods in") : t(d === "GAVE" ? "entry.gave" : "entry.got")}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={t("entry.amount")}><Input name="amount" inputMode="decimal" required placeholder="0" /></Field>
        <Field label={t("entry.date")}><Input name="date" type="date" defaultValue={today} required /></Field>
        {direction === "GAVE" && !isSupplier ? (
          <Field label={t("entry.due")}><Input name="dueDate" type="date" /></Field>
        ) : (
          <Field label={t("entry.paidBy")}>
            <Select name="paymentMode" value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
              <option value="">{paymentOut ? "Not a payment (credit given)" : t("entry.notPayment")}</option>
            </Select>
          </Field>
        )}
        <Field label={t("entry.note")}><Input name="note" /></Field>
      </div>

      {direction === "GOT" && openBills.length > 0 && (
        <fieldset className="space-y-2 rounded-xl border border-line p-3 text-sm">
          <legend className="px-1 text-sm text-muted">Which bills is this for?</legend>
          <label className="mr-4 inline-flex items-center gap-2">
            <input type="radio" name="settle" value="AUTO" checked={settle === "AUTO"} onChange={() => setSettle("AUTO")} className="accent-[var(--brand)]" /> Oldest bills first (easiest)
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="settle" value="BILLS" checked={settle === "BILLS"} onChange={() => setSettle("BILLS")} className="accent-[var(--brand)]" /> I will choose
          </label>
          {settle === "BILLS" && (
            <ul className="divide-y divide-line">
              {openBills.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span>{b.label}<span className="block text-xs text-muted">{b.due ? `Due ${b.due} · ` : ""}{b.open} open</span></span>
                  <Input name={`alloc_${b.id}`} inputMode="decimal" placeholder="₹ to settle" className="w-32" />
                </li>
              ))}
            </ul>
          )}
          {settle === "BILLS" && <p className="text-xs text-muted">Anything you don’t assign goes to the oldest bills first. If they pay only part of a bill, the rest stays pending.</p>}
        </fieldset>
      )}

      <AttachmentInput />
      {canNotify ? (
        receiptGoesOut ? (
          <p className="text-sm text-muted">{t("entry.receipt")}</p>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notify" defaultChecked={notifyDefault} className="size-4 accent-[var(--brand)]" />
            {t("entry.notify")}
          </label>
        )
      ) : null}
      <CreditWarning reasons={state.warning} pending={pending} />
      <ErrorText>{state.error}</ErrorText>
      <button disabled={pending} className={buttonClass("primary")}>{pending ? t("entry.saving") : t("entry.save")}</button>
    </ActionForm>
  );
}
