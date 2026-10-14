"use client";

import { ActionForm } from "@/components/action-form";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, type OtpState } from "@/app/actions/auth";
import { Card, ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Logo } from "@/components/icon";
import { BRAND } from "@/lib/brand";

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
  const askingForCode = state.step !== "phone";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-8">
      <Link href="/" className="mb-8 flex items-center gap-2 text-xl font-bold"><Logo size={34} />{BRAND.NAME}</Link>
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight">{askingForCode ? "Enter the code" : "Welcome"}</h1>
      {invited && !askingForCode && <p className="mb-3 rounded-xl bg-brand/10 px-4 py-3 text-base">You were invited. Sign in to start — it takes about two minutes.</p>}
      <p className="mb-6 text-lg text-muted">
        {askingForCode ? "We sent a 6-digit code to your mobile." : "Type your mobile number. We will send you a 6-digit code. No password to remember."}
      </p>
      <Card>
        <ActionForm dispatch={action} pending={pending} className="space-y-5">
          {state.step === "phone" ? (
            <>
              <Field label="Your mobile number">
                <Input name="phone" inputMode="tel" autoComplete="tel" placeholder="98480 12345" required autoFocus className="text-xl" />
              </Field>
              <ErrorText>{state.error}</ErrorText>
              <SubmitButton className="w-full">Send me the code</SubmitButton>
            </>
          ) : (
            <>
              <input type="hidden" name="phone" value={state.phone} />
              <p className="text-base">Code sent to <span className="font-semibold">+{state.phone}</span></p>
              {state.devCode && (
                <p className="rounded-xl bg-brand/10 px-4 py-3 text-base">
                  Test mode — your code is <span className="font-mono text-xl font-bold">{state.devCode}</span>
                </p>
              )}
              <Field label="6-digit code">
                <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="text-center font-mono text-2xl tracking-[0.4em]" />
              </Field>
              <ErrorText>{state.error}</ErrorText>
              <SubmitButton className="w-full">Open {BRAND.NAME}</SubmitButton>
            </>
          )}
        </ActionForm>
      </Card>
    </main>
  );
}
