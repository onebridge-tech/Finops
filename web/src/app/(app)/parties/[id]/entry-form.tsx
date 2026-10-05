"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState, useEffect, useRef, useState } from "react";
import { addEntry } from "@/app/actions/ledger";
import { ErrorText, Field, Input, buttonClass } from "@/components/ui";

export function EntryForm({ partyId, today }: { partyId: string; today: string }) {
  const [state, action, pending] = useActionState(addEntry, {});
  const [direction, setDirection] = useState<"GAVE" | "GOT">("GAVE");
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="space-y-3">
      <input type="hidden" name="partyId" value={partyId} />
      <input type="hidden" name="direction" value={direction} />
      <div className="grid grid-cols-2 gap-2">
        {(["GAVE", "GOT"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${direction === d ? (d === "GAVE" ? "border-gave bg-gave/10 text-gave" : "border-got bg-got/10 text-got") : "border-line text-muted"}`}
          >
            {d === "GAVE" ? "You gave (credit / goods)" : "You got (payment)"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" required placeholder="0.00" /></Field>
        <Field label="Date"><Input name="date" type="date" defaultValue={today} required /></Field>
        <Field label="Due date"><Input name="dueDate" type="date" disabled={direction === "GOT"} /></Field>
        <Field label="Note"><Input name="note" placeholder="Bill no., items, mode…" /></Field>
      </div>
      <ErrorText>{state.error}</ErrorText>
      <button disabled={pending} className={buttonClass("primary")}>{pending ? "Saving…" : "Save entry"}</button>
    </ActionForm>
  );
}
