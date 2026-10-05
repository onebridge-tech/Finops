"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { unlock } from "@/app/actions/auth";
import { ErrorText, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function UnlockForm() {
  const [state, action, pending] = useActionState(unlock, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3">
      <Input name="pin" type="password" inputMode="numeric" autoComplete="current-password" maxLength={6} required autoFocus
        className="text-center text-2xl tracking-[0.5em]" aria-label="PIN" />
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full">Unlock</SubmitButton>
    </ActionForm>
  );
}
