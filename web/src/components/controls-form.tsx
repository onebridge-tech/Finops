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
      <Field label="Credit limit check" hint="You can set a credit limit for each customer. This decides what happens when a new bill would take them over it: nothing, a warning, or a stop.">
        <Select name="creditControl" defaultValue={v.creditControl}>
          <option value="OFF">Off</option>
          <option value="WARN">Warn me, but let it go through</option>
          <option value="BLOCK">Stop it (the owner can still allow it)</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="creditBlockOverdue" defaultChecked={v.creditBlockOverdue} className="size-4 accent-[var(--brand)]" />
        <span>Also act when the customer already has overdue bills<span className="block text-xs text-muted">If they have not paid an old bill on time, new credit is warned or stopped even when they are under the limit.</span></span>
      </label>
      <Field label="Daily summary for you" hint="One short message at 8 am: what you collected, who is late, and calls to make today. Sent to you only, not to customers.">
        <Select name="digestFrequency" defaultValue={v.digestFrequency}>
          <option value="OFF">Off</option><option value="DAILY">Every morning</option><option value="WEEKLY">Every Monday</option>
        </Select>
      </Field>
      <Field label="Send summary by">
        <Select name="digestChannel" defaultValue={v.digestChannel}><option value="WHATSAPP">WhatsApp</option><option value="SMS">SMS</option><option value="EMAIL">Email</option></Select>
      </Field>
      <div className="space-y-2 sm:col-span-2">
        <ErrorText>{state.error}</ErrorText>
        {state.ok && <p className="text-sm text-got">Saved.</p>}
        <SubmitButton>Save controls</SubmitButton>
      </div>
    </ActionForm>
  );
}
