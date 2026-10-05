"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { setPin } from "@/app/actions/auth";
import { updateMyName } from "@/app/actions/team";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function NameForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState(updateMyName, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="flex flex-wrap items-end gap-2">
      <div className="flex-1"><Field label="Shown to your team and on activity"><Input name="name" defaultValue={name} required /></Field></div>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <ErrorText>{state.error}</ErrorText>
      {state.info && <p className="w-full text-sm text-got">{state.info}</p>}
    </ActionForm>
  );
}

export function PinForm({ hasPin, lockAfterMin }: { hasPin: boolean; lockAfterMin: number }) {
  const [state, action, pending] = useActionState(setPin, {});
  return (
    <div className="space-y-3">
      <ActionForm dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-3">
        <Field label={hasPin ? "New PIN" : "PIN (4–6 digits)"}>
          <Input name="pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} required />
        </Field>
        <Field label="Repeat PIN"><Input name="confirm" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} required /></Field>
        <Field label="Lock after">
          <Select name="lockAfterMin" defaultValue={String(lockAfterMin)}>
            <option value="1">1 minute idle</option>
            <option value="5">5 minutes idle</option>
            <option value="15">15 minutes idle</option>
            <option value="60">1 hour idle</option>
          </Select>
        </Field>
        <div className="space-y-2 sm:col-span-3">
          <ErrorText>{state.error}</ErrorText>
          {state.ok && <p className="text-sm text-got">Saved.</p>}
          <SubmitButton>{hasPin ? "Change PIN" : "Turn on app lock"}</SubmitButton>
        </div>
      </ActionForm>
      {hasPin && (
        <ActionForm dispatch={action} pending={pending}>
          <input type="hidden" name="remove" value="1" />
          <button className="text-xs text-muted underline hover:text-gave">Turn off app lock</button>
        </ActionForm>
      )}
    </div>
  );
}
