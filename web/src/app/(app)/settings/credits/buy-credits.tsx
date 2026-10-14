"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { buyCredits } from "@/app/actions/messaging";
import { ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatINR } from "@/lib/money";

export function BuyCredits({ packs }: { packs: { id: string; credits: number; pricePaise: number }[] }) {
  const [state, action, pending] = useActionState(buyCredits, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3">
      {packs.map((p, i) => (
        <label key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-base has-[:checked]:border-brand">
          <span className="flex items-center gap-2">
            <input type="radio" name="pack" value={p.id} defaultChecked={i === 0} className="accent-[var(--brand)]" />
            {p.credits.toLocaleString("en-IN")} credits
          </span>
          <span className="tabular-nums">{formatINR(p.pricePaise)}</span>
        </label>
      ))}
      <p className="text-sm text-muted">Payments are in test mode: credits are added straight away and no money is taken.</p>
      <ErrorText>{state.error}</ErrorText>
      {state.info && <p className="text-base text-got">{state.info}</p>}
      <SubmitButton>Add credits</SubmitButton>
    </ActionForm>
  );
}
