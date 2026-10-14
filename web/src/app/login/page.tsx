"use client";

import { ActionForm } from "@/components/action-form";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { login, type OtpState } from "@/app/actions/auth";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Icon, Logo } from "@/components/icon";
import { BRAND } from "@/lib/brand";

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

const POINTS = [
  ["wallet", "See who owes you, in one list"],
  ["send", "Ask for money on WhatsApp in one tap"],
  ["bill", "Make GST bills and share them"],
] as const;

function Login() {
  const [state, action, pending] = useActionState<OtpState, FormData>(login, { step: "phone" });
  const invited = useSearchParams().get("invited") === "1";
  const askingForCode = state.step !== "phone";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand p-12 text-brand-ink lg:flex">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold"><span className="flex size-9 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">₹</span>{BRAND.NAME}</Link>
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">Know who owes you. Get paid faster.</h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-[15px]">
                <span className="flex size-9 items-center justify-center rounded-lg bg-white/15"><Icon name={icon} size={18} /></span>{text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm opacity-80">Works on any phone, tablet or computer.</p>
      </section>

      <section className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 flex items-center gap-2 font-semibold lg:hidden"><Logo size={30} />{BRAND.NAME}</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{askingForCode ? "Enter the code" : "Sign in"}</h1>
          <p className="mb-6 mt-1.5 text-sm text-muted">
            {askingForCode ? "We sent a 6-digit code to your mobile." : "Type your mobile number. We will send you a 6-digit code. No password to remember."}
          </p>
          {invited && !askingForCode && <p className="mb-4 rounded-lg bg-brand-soft px-3 py-2.5 text-sm">You were invited. Sign in to start. It takes about two minutes.</p>}
          <ActionForm dispatch={action} pending={pending} className="space-y-4">
            {state.step === "phone" ? (
              <>
                <Field label="Mobile number">
                  <Input name="phone" inputMode="tel" autoComplete="tel" placeholder="98480 12345" required autoFocus />
                </Field>
                <ErrorText>{state.error}</ErrorText>
                <SubmitButton className="w-full">Send me the code</SubmitButton>
              </>
            ) : (
              <>
                <input type="hidden" name="phone" value={state.phone} />
                <p className="text-sm">Code sent to <span className="font-semibold">+{state.phone}</span></p>
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
      </section>
    </main>
  );
}
