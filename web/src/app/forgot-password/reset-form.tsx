"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { resetPassword, type ResetState } from "@/app/actions/auth";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { CodeStep } from "@/components/code-step";
import { PASSWORD_MIN } from "@/lib/password-rules";

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, { step: "email" });

  if (state.step === "verify") {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mb-6 mt-1.5 text-sm text-muted">{state.info ?? `We emailed a 6-digit code to ${state.email}.`} It expires in 10 minutes.</p>
        <ActionForm dispatch={action} pending={pending} className="space-y-4">
          <CodeStep devCode={state.devCode} />
          <Field label="New password" hint={`At least ${PASSWORD_MIN} characters.`}>
            <PasswordInput name="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={128} />
          </Field>
          <Field label="Type the new password again">
            <PasswordInput name="confirm" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={128} />
          </Field>
          <ErrorText>{state.error}</ErrorText>
          <SubmitButton className="w-full">Save password and sign in</SubmitButton>
          <p className="text-xs text-muted">Saving signs you out on every other device.</p>
        </ActionForm>
        <p className="mt-6 text-center text-sm text-muted">No email? Check spam, or <a href="/forgot-password" className="font-medium text-brand hover:underline">try again</a></p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Forgot your password?</h1>
      <p className="mb-6 mt-1.5 text-sm text-muted">Enter the email you sign in with. We&apos;ll send you a code to set a new password.</p>
      <ActionForm dispatch={action} pending={pending} className="space-y-4">
        <Field label="Email address">
          <Input name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required autoFocus maxLength={254} defaultValue={state.email} />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton className="w-full">Send me a code</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">Remembered it? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></p>
    </>
  );
}
