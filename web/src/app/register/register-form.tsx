"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { register, type RegisterState } from "@/app/actions/auth";
import { ErrorText, Field, Input } from "@/components/ui";
import { DataNotice } from "@/components/data-notice";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { GoogleButton } from "@/components/google-button";
import { CodeStep } from "@/components/code-step";
import { BRAND } from "@/lib/brand";
import { PASSWORD_MIN } from "@/lib/password-rules";

export function RegisterForm({ google }: { google: boolean }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(register, { step: "form" });

  if (state.step === "verify") {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mb-6 mt-1.5 text-sm text-muted">We sent a 6-digit code to <span className="font-medium text-ink">{state.email}</span>. Enter it to finish creating your account.</p>
        <ActionForm dispatch={action} pending={pending} className="space-y-4">
          <CodeStep devCode={state.devCode} />
          {state.info && <p role="status" className="text-sm text-got">{state.info}</p>}
          <ErrorText>{state.error}</ErrorText>
          <SubmitButton className="w-full">Create my account</SubmitButton>
          <p className="text-center text-sm text-muted">
            No email? Check spam, or{" "}
            <button type="submit" name="resend" value="1" formNoValidate className="font-medium text-brand hover:underline">send a new code</button>
          </p>
        </ActionForm>
        <p className="mt-6 text-center text-sm text-muted">Wrong email? <a href="/register" className="font-medium text-brand hover:underline">Start again</a></p>
      </>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mb-6 mt-1.5 text-sm text-muted">Free to start. It takes about two minutes.</p>

      {google && <GoogleButton label="Sign up with Google" />}

      <ActionForm dispatch={action} pending={pending} className="space-y-4">
        <Field label="Your name">
          <Input name="name" autoComplete="name" placeholder="Ravi Kumar" required maxLength={80} autoFocus />
        </Field>
        <Field label="Email address" hint="You'll sign in with this. We'll send a code to check it.">
          <Input name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} />
        </Field>
        <Field label="Mobile number">
          <Input name="mobile" inputMode="tel" autoComplete="tel-national" placeholder="98480 12345" required maxLength={14} />
        </Field>
        <Field label="Password" hint={`At least ${PASSWORD_MIN} characters. A short sentence is easy to remember.`}>
          <PasswordInput name="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={128} />
        </Field>
        <Field label="Type the password again">
          <PasswordInput name="confirm" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={128} />
        </Field>
        <DataNotice
          why="Your name and email make your account: you sign in with the email, and we send codes and important account notices to it. Your mobile number lets us or your shop’s team reach you about your account. Your password is stored only as a scrambled code that nobody can read, not even us."
          keep="Until you delete your account (Security & sign-in → Delete my account). Then it is erased within the days stated in our Privacy Policy."
          shared="Nobody outside FinOps, except the email and SMS services that deliver your codes. We never sell it or use it for advertising."
        />
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="terms" required className="mt-0.5 size-4 accent-[var(--brand)]" />
          <span>I agree to the <Link href="/terms" className="font-medium text-brand underline" target="_blank">Terms of Use</Link> and <Link href="/privacy" className="font-medium text-brand underline" target="_blank">Privacy Policy</Link>.</span>
        </label>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton className="w-full">Continue</SubmitButton>
      </ActionForm>

      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link></p>
      <p className="mt-2 text-center text-xs text-muted">{BRAND.NAME} never asks for your password on WhatsApp or by phone.</p>
    </>
  );
}
