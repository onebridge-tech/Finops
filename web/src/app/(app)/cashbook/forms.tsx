"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { addCashAdjustment, closeDay, setOpeningCash } from "@/app/actions/cash";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function CloseDayForm({ today, branchId }: { today: string; branchId: string }) {
  const [state, action, pending] = useActionState(closeDay, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="branchId" value={branchId} />
      <Field label="Day"><Input name="date" type="date" defaultValue={today} max={today} required /></Field>
      <Field label="Cash counted (₹)" hint="Count the notes and coins in your drawer now and type the total. We show the difference from what the books say, so you can spot missing cash."><Input name="counted" inputMode="decimal" required /></Field>
      <div className="sm:col-span-2"><Field label="Note"><Input name="note" placeholder="Optional, e.g. ₹200 short, change given" /></Field></div>
      <div className="flex items-center gap-3 sm:col-span-4">
        <SubmitButton>Close today</SubmitButton>
        <ErrorText>{state.error}</ErrorText>
        {state.info && <span className="text-sm">{state.info}</span>}
      </div>
    </ActionForm>
  );
}

export function AdjustmentForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addCashAdjustment, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-5">
      <Field label="Date"><Input name="date" type="date" defaultValue={today} max={today} required /></Field>
      <Field label="Direction">
        <Select name="direction" defaultValue="OUT"><option value="OUT">Money taken out of the drawer</option><option value="IN">Money put into the drawer</option></Select>
      </Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" required /></Field>
      <div className="sm:col-span-2"><Field label="What for"><Input name="note" required placeholder="Deposited to bank / owner drawings" /></Field></div>
      <div className="flex items-center gap-3 sm:col-span-5"><SubmitButton variant="secondary">Add adjustment</SubmitButton><ErrorText>{state.error}</ErrorText></div>
    </ActionForm>
  );
}

export function OpeningCashForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState(setOpeningCash, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="flex flex-wrap items-end gap-3">
      <Field label="Cash in hand when you started using the app (₹)"><Input name="opening" inputMode="decimal" defaultValue={value} /></Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <ErrorText>{state.error}</ErrorText>
      {state.info && <span className="text-sm text-got">{state.info}</span>}
    </ActionForm>
  );
}
