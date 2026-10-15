"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { linkEmail, type LinkState } from "@/app/actions/auth";
import { ErrorText, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

/** Add an email address as another way to sign in: type it, then type the code we send to it. */
export function EmailLink() {
  const [state, action, pending] = useActionState<LinkState, FormData>(linkEmail, { step: "start" });
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-2">
      {state.step === "start" ? (
        <div className="flex flex-wrap gap-2">
          <Input name="to" type="email" autoComplete="email" placeholder="you@example.com" aria-label="Email address" required className="min-w-0 flex-1" />
          <SubmitButton variant="secondary">Send code</SubmitButton>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">We sent a code to {state.email}.</p>
          {state.devCode && <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm">Test mode — code <span className="font-mono font-semibold">{state.devCode}</span></p>}
          <div className="flex flex-wrap gap-2">
            <Input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} placeholder="6-digit code" aria-label="6-digit code" required autoFocus className="min-w-0 flex-1" />
            <SubmitButton>Verify</SubmitButton>
          </div>
        </>
      )}
      <ErrorText>{state.error}</ErrorText>
      {state.ok && <p role="status" className="text-sm text-got">Email added. You can now sign in with it.</p>}
    </ActionForm>
  );
}
