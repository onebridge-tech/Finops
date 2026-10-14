"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "./action-form";
import { addPromise } from "@/app/actions/ledger";
import { ErrorText, Field, Input } from "./ui";
import { SubmitButton } from "./submit-button";

/** Log "they promised to pay on…" after a call or visit (CP-09). */
export function PromiseForm({ partyId, today }: { partyId: string; today: string }) {
  const [state, action, pending] = useActionState(addPromise, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="partyId" value={partyId} />
      <Field label="Promised date"><Input name="date" type="date" required min={today} defaultValue={today} /></Field>
      <Field label="Amount (₹)" hint="Optional"><Input name="amount" inputMode="decimal" /></Field>
      <div className="sm:col-span-2"><Field label="Note"><Input name="note" placeholder="Spoke to owner, will send UPI" /></Field></div>
      <div className="flex items-end gap-3 sm:col-span-4">
        <SubmitButton variant="secondary">Note their promise</SubmitButton>
        <ErrorText>{state.error}</ErrorText>
        <span className="text-sm text-muted">Creates a follow-up for that day and holds automatic reminders until the day after.</span>
      </div>
    </ActionForm>
  );
}
