"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { updateUpiId, type FormState } from "@/app/actions/business";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function UpiForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updateUpiId, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3">
      <Field label="Your UPI ID" hint="Find it in Google Pay, PhonePe, Paytm or your bank's app, under your profile.">
        <Input name="upiId" placeholder="yourshop@okicici" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={60} autoFocus />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full">Save and make my QR</SubmitButton>
    </ActionForm>
  );
}
