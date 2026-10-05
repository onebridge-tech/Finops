"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionForm } from "./action-form";
import { addFollowUp, completeFollowUp } from "@/app/actions/followups";
import { ErrorText, Field, Input, Select } from "./ui";
import { SubmitButton } from "./submit-button";
import { useT } from "./i18n-provider";

export function AddFollowUpForm({ partyId, today, team }: { partyId: string; today: string; team: { id: string; name: string }[] | null }) {
  const [state, action, pending] = useActionState(addFollowUp, {});
  const t = useT();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="partyId" value={partyId} />
      <div className="sm:col-span-2"><Field label={t("fu.about")}><Input name="note" required placeholder="Call about pending ₹12,000 / show new catalogue" /></Field></div>
      <Field label="Date"><Input name="date" type="date" required defaultValue={today} min={today} /></Field>
      <Field label="Time"><Input name="time" type="time" defaultValue="10:00" /></Field>
      {team && (
        <Field label="Who">
          <Select name="assignedToId" defaultValue="">
            <option value="">Me</option>
            {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
      )}
      <div className="flex items-end gap-3 sm:col-span-3">
        <SubmitButton variant="secondary">{t("fu.add")}</SubmitButton>
        <ErrorText>{state.error}</ErrorText>
      </div>
    </ActionForm>
  );
}

/** "Done" with an outcome and an optional next date. */
export function CompleteFollowUp({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(completeFollowUp, {});
  const t = useT();
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-brand underline">{t("fu.markDone")}</button>;
  return (
    <ActionForm dispatch={action} pending={pending} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="followUpId" value={id} />
      <Input name="outcome" placeholder="What happened? e.g. promised to pay Friday" className="min-w-56 flex-1" />
      <label className="text-xs text-muted">Next follow-up <Input name="nextDate" type="date" className="w-auto" /></label>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <ErrorText>{state.error}</ErrorText>
    </ActionForm>
  );
}
