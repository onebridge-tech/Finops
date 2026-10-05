"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { respondToQuote } from "@/app/actions/billing";
import { ErrorText, Input, buttonClass } from "@/components/ui";

export function QuoteResponse({ token, business }: { token: string; business: string }) {
  const [state, action, pending] = useActionState(respondToQuote, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <p className="font-medium">Happy with this quotation from {business}?</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input name="name" placeholder="Your name" className="max-w-56" autoComplete="name" />
        <button name="response" value="accept" disabled={pending} className={buttonClass("primary")}>Accept</button>
        <button name="response" value="decline" disabled={pending} className={buttonClass("secondary")}>Decline</button>
      </div>
      <ErrorText>{state.error}</ErrorText>
    </ActionForm>
  );
}
