"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { deliverOrder, receiveOrder } from "@/app/actions/orders";
import { CreditWarning } from "@/components/credit-warning";
import { ErrorText, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type L = { id: string; description: string; unit: string; ordered: number; done: number; pending: number };

export function FulfilForm({ kind, orderId, lines }: { kind: "SALES" | "PURCHASE"; orderId: string; lines: L[] }) {
  const [state, action, pending] = useActionState(kind === "SALES" ? deliverOrder : receiveOrder, {});
  const fillAll = (form: HTMLFormElement | null) =>
    lines.forEach((l) => {
      const el = form?.elements.namedItem(`qty_${l.id}`) as HTMLInputElement | null;
      if (el) el.value = String(l.pending);
    });
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <ul className="divide-y divide-line text-base">
        {lines.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span>
              {l.description}
              <span className="block text-sm text-muted">Ordered {l.ordered} {l.unit} · {kind === "SALES" ? "delivered" : "received"} {l.done} · pending {l.pending}</span>
            </span>
            {l.pending > 0
              ? <Input name={`qty_${l.id}`} inputMode="decimal" placeholder="Qty now" className="w-28" aria-label={`Quantity for ${l.description}`} />
              : <span className="text-sm text-got">complete</span>}
          </li>
        ))}
      </ul>
      {kind === "PURCHASE" && <Input name="billNo" placeholder="Supplier’s bill number (optional)" className="max-w-xs" />}
      <CreditWarning reasons={state.warning} pending={pending} />
      <ErrorText>{state.error}</ErrorText>
      <div className="flex items-center gap-3">
        <SubmitButton>{kind === "SALES" ? "Deliver & create invoice" : "Receive goods"}</SubmitButton>
        <button type="button" className="text-sm text-muted underline" onClick={(e) => fillAll(e.currentTarget.form)}>Fill everything pending</button>
        {state.ok && <span className="text-base text-got">Received.</span>}
      </div>
    </ActionForm>
  );
}
