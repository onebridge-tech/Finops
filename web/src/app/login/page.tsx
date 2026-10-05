"use client";

import { ActionForm } from "@/components/action-form";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { login, type OtpState } from "@/app/actions/auth";
import { Card, ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const [state, action, pending] = useActionState<OtpState, FormData>(login, { step: "phone" });
  const invited = useSearchParams().get("invited") === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-bold">Sign in</h1>
      {invited && <p className="mb-3 rounded-lg bg-brand/10 px-3 py-2 text-sm">Welcome! Create your free ledger in about two minutes.</p>}
      <p className="mb-6 text-sm text-muted">We’ll send a 6-digit code to your mobile.</p>
      <Card>
        <ActionForm dispatch={action} pending={pending} className="space-y-4">
          {state.step === "phone" ? (
            <>
              <Field label="Mobile number">
                <Input name="phone" inputMode="tel" autoComplete="tel" placeholder="98480 12345" required autoFocus />
              </Field>
              <ErrorText>{state.error}</ErrorText>
              <SubmitButton className="w-full">Send code</SubmitButton>
            </>
          ) : (
            <>
              <input type="hidden" name="phone" value={state.phone} />
              <p className="text-sm">Code sent to <span className="font-medium">+{state.phone}</span></p>
              {state.devCode && (
                <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm">
                  Development mode — your code is <span className="font-mono font-semibold">{state.devCode}</span>
                </p>
              )}
              <Field label="6-digit code">
                <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus />
              </Field>
              <ErrorText>{state.error}</ErrorText>
              <SubmitButton className="w-full">Verify &amp; continue</SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>
    </main>
  );
}
