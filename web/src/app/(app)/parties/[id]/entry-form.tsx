"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState, useEffect, useRef, useState } from "react";
import { addEntry } from "@/app/actions/ledger";
import { ErrorText, Field, Input, Select, buttonClass } from "@/components/ui";
import { PAYMENT_MODES, PAYMENT_MODE_LABEL } from "@/lib/format";
import { AttachmentInput } from "@/components/attachment-input";
import { useMode, useT } from "@/components/i18n-provider";

type Props = {
  partyId: string;
  today: string;
  isSupplier: boolean;
  canNotify: boolean; // party has consent and a contact
  notifyDefault: boolean;
  autoReceipt: boolean;
};

export function EntryForm({ partyId, today, isSupplier, canNotify, notifyDefault, autoReceipt }: Props) {
  const [state, action, pending] = useActionState(addEntry, {});
  const [direction, setDirection] = useState<"GAVE" | "GOT">("GAVE");
  const [mode, setMode] = useState(isSupplier ? "" : "CASH");
  const form = useRef<HTMLFormElement>(null);
  const t = useT();
  const accountant = useMode() === "ACCOUNTANT";

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  const receiptGoesOut = direction === "GOT" && mode !== "" && autoReceipt;

  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="space-y-3">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="direction" value={direction} />
      <div className="grid grid-cols-2 gap-2">
        {(["GAVE", "GOT"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${direction === d ? (d === "GAVE" ? "border-gave bg-gave/10 text-gave" : "border-got bg-got/10 text-got") : "border-line text-muted"}`}
          >
            {accountant ? (d === "GAVE" ? "Debit (Dr) — party owes more" : "Credit (Cr) — payment / goods in") : t(d === "GAVE" ? "entry.gave" : "entry.got")}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={t("entry.amount")}><Input name="amount" inputMode="decimal" required placeholder="0.00" /></Field>
        <Field label={t("entry.date")}><Input name="date" type="date" defaultValue={today} required /></Field>
        {direction === "GAVE" ? (
          <Field label={t("entry.due")}><Input name="dueDate" type="date" /></Field>
        ) : (
          <Field label={t("entry.paidBy")}>
            <Select name="paymentMode" value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
              <option value="">{t("entry.notPayment")}</option>
            </Select>
          </Field>
        )}
        <Field label={t("entry.note")}><Input name="note" /></Field>
      </div>
      <AttachmentInput />
      {canNotify ? (
        receiptGoesOut ? (
          <p className="text-xs text-muted">{t("entry.receipt")}</p>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="notify" defaultChecked={notifyDefault} className="size-4 accent-[var(--brand)]" />
            {t("entry.notify")}
          </label>
        )
      ) : null}
      <ErrorText>{state.error}</ErrorText>
      <button disabled={pending} className={buttonClass("primary")}>{pending ? t("entry.saving") : t("entry.save")}</button>
    </ActionForm>
  );
}
