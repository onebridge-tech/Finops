"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { createCreditNote } from "@/app/actions/notes";
import { Card, ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type L = { id: string; description: string; unit: string; rate: string; taxPct: number; maxMilli: number; tracked: boolean };

export function CreditNoteForm({ invoiceId, lines }: { invoiceId: string; lines: L[] }) {
  const [state, action, pending] = useActionState(createCreditNote, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Card className="divide-y divide-line p-0 text-base">
        {lines.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <span>{l.description}<span className="block text-sm text-muted">{l.rate} · GST {l.taxPct}% · {l.maxMilli / 1000} {l.unit} can still be credited</span></span>
            <span className="flex items-center gap-3">
              {l.maxMilli > 0 ? (
                <>
                  <Input name={`qty_${l.id}`} inputMode="decimal" placeholder="Qty" className="w-24" aria-label={`Quantity to credit for ${l.description}`} />
                  {l.tracked && <label className="flex items-center gap-1 text-sm"><input type="checkbox" name={`ret_${l.id}`} defaultChecked className="size-4 accent-[var(--brand)]" /> back to stock</label>}
                </>
              ) : <span className="text-sm text-muted">fully credited</span>}
            </span>
          </div>
        ))}
      </Card>
      <Card><Field label="Reason"><Input name="reason" required placeholder="Goods returned damaged / rate difference" /></Field></Card>
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton>Make a return note</SubmitButton>
    </ActionForm>
  );
}
