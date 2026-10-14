"use client";

import { useActionState } from "react";
import { ActionForm } from "./action-form";
import { updateControls } from "@/app/actions/business";
import { ErrorText, Field, Select } from "./ui";
import { SubmitButton } from "./submit-button";

type V = { creditControl: string; creditBlockOverdue: boolean; digestFrequency: string; digestChannel: string };

export function ControlsForm({ v }: { v: V }) {
  const [state, action, pending] = useActionState(updateControls, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="grid gap-4 sm:grid-cols-2">
      <Field label="Credit limit check" hint="Checks a new bill or credit against the party’s credit limit.">
        <Select name="creditControl" defaultValue={v.creditControl}>
          <option value="OFF">Off</option>
          <option value="WARN">Warn me, but let it go through</option>
          <option value="BLOCK">Stop it (the owner can still allow it)</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-base">
        <input type="checkbox" name="creditBlockOverdue" defaultChecked={v.creditBlockOverdue} className="size-4 accent-[var(--brand)]" />
        Also act when the party already has overdue bills
      </label>
      <Field label="Daily summary for you" hint="A short summary of collections, dues and follow-ups at 8 am.">
        <Select name="digestFrequency" defaultValue={v.digestFrequency}>
          <option value="OFF">Off</option><option value="DAILY">Every morning</option><option value="WEEKLY">Every Monday</option>
        </Select>
      </Field>
      <Field label="Send summary by">
        <Select name="digestChannel" defaultValue={v.digestChannel}><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Email</option></Select>
      </Field>
      <div className="space-y-2 sm:col-span-2">
        <ErrorText>{state.error}</ErrorText>
        {state.ok && <p className="text-base text-got">Saved.</p>}
        <SubmitButton>Save controls</SubmitButton>
      </div>
    </ActionForm>
  );
}
