"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { signIn, type SignInState } from "@/app/actions/auth";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { GoogleButton } from "@/components/google-button";
import { BRAND } from "@/lib/brand";

const NOTICE: Record<string, string> = {
  google_off: "Google sign-in is not switched on yet. Use your email and password instead.",
  google_failed: "Google sign-in did not finish. Please try again, or use your email and password.",
};

export function LoginForm({ google, error, invited }: { google: boolean; error?: string; invited: boolean }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 mt-1.5 text-sm text-muted">Welcome back to {BRAND.NAME}.</p>
      {invited && <p className="mb-4 rounded-lg bg-brand-soft px-3 py-2.5 text-sm">You were invited. <Link href="/register" className="font-medium underline">Create your account</Link> with the email you were invited on.</p>}
      {error && NOTICE[error] && <p role="alert" className="mb-4 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm text-warn">{NOTICE[error]}</p>}

      {google && <GoogleButton />}

      <ActionForm dispatch={action} pending={pending} className="space-y-4">
        <Field label="Email address">
          <Input name="email" type="email" inputMode="email" autoComplete="username" placeholder="you@example.com" required autoFocus maxLength={254} />
        </Field>
        <Field label="Password">
          <PasswordInput name="password" autoComplete="current-password" required maxLength={128} />
        </Field>
        <div className="-mt-1 text-right text-sm"><Link href="/forgot-password" className="font-medium text-brand hover:underline">Forgot password?</Link></div>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </ActionForm>

      <p className="mt-6 text-center text-sm text-muted">New to {BRAND.NAME}? <Link href="/register" className="font-medium text-brand hover:underline">Create an account</Link></p>
    </>
  );
}
