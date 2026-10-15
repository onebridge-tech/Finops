"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState, useState } from "react";
import { login, type Method, type OtpState } from "@/app/actions/auth";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { BRAND } from "@/lib/brand";

const NOTICE: Record<string, string> = {
  google_off: "Google sign-in is not switched on yet. Use your email or phone instead.",
  google_failed: "Google sign-in did not finish. Please try again, or use your email or phone.",
};

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function LoginForm({ google, error, invited }: { google: boolean; error?: string; invited: boolean }) {
  const [method, setMethod] = useState<Method>("email");
  const [state, action, pending] = useActionState<OtpState, FormData>(login, { step: "start", method: "email" });
  const verifying = state.step === "verify";
  const m: Method = verifying ? state.method : method;

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{verifying ? "Enter the code" : "Sign in"}</h1>
      <p className="mb-6 mt-1.5 text-sm text-muted">
        {verifying
          ? `We sent a 6-digit code to ${m === "email" ? state.to : `+${state.to}`}.`
          : `Choose how you want to sign in to ${BRAND.NAME}. No password to remember.`}
      </p>
      {invited && !verifying && <p className="mb-4 rounded-lg bg-brand-soft px-3 py-2.5 text-sm">You were invited. Sign in to start. It takes about two minutes.</p>}
      {error && NOTICE[error] && !verifying && <p role="alert" className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm text-warn">{NOTICE[error]}</p>}

      {!verifying && google && (
        <>
          <a href="/api/auth/google" className="flex min-h-10 items-center justify-center gap-2.5 rounded-lg border border-line bg-card px-4 text-sm font-medium shadow-sm transition hover:bg-bg">
            <GoogleMark />Continue with Google
          </a>
          <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
        </>
      )}

      {!verifying && (
        <div role="tablist" aria-label="Sign-in method" className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-line/50 p-1">
          {(["email", "phone"] as const).map((x) => (
            <button key={x} type="button" role="tab" aria-selected={method === x} onClick={() => setMethod(x)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${method === x ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
              {x === "email" ? "Email" : "Mobile number"}
            </button>
          ))}
        </div>
      )}

      <ActionForm dispatch={action} pending={pending} className="space-y-4">
        <input type="hidden" name="method" value={m} />
        {!verifying ? (
          <>
            <Field label={m === "email" ? "Email address" : "Mobile number"}>
              {m === "email"
                ? <Input key="email" name="to" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required autoFocus />
                : <Input key="phone" name="to" inputMode="tel" autoComplete="tel" placeholder="98480 12345" required autoFocus />}
            </Field>
            <ErrorText>{state.error}</ErrorText>
            <SubmitButton className="w-full">Send me the code</SubmitButton>
          </>
        ) : (
          <>
            <input type="hidden" name="to" value={state.to} />
            {state.devCode && (
              <p className="rounded-lg border border-brand/20 bg-brand-soft px-3 py-2.5 text-sm">
                Test mode — your code is <span className="font-mono text-base font-semibold">{state.devCode}</span>
              </p>
            )}
            <Field label="6-digit code">
              <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="text-center font-mono text-lg tracking-[0.35em]" />
            </Field>
            <ErrorText>{state.error}</ErrorText>
            <SubmitButton className="w-full">Open {BRAND.NAME}</SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  );
}
