"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { addCashSale, assignCashSale, voidCashSale } from "@/app/actions/cash-sales";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function CashSaleForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addCashSale, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-5">
      <Field label="Date"><Input name="date" type="date" defaultValue={today} max={today} required /></Field>
      <div className="sm:col-span-2"><Field label="What was sold"><Input name="item" required maxLength={120} placeholder="Tea, 2 cups" /></Field></div>
      <Field label="Quantity" hint="Optional"><Input name="qty" inputMode="decimal" /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" required /></Field>
      <Field label="Paid by"><Select name="mode" defaultValue="cash"><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option><option value="card">Card</option></Select></Field>
      <div className="flex items-center gap-3 sm:col-span-5"><SubmitButton>Add sale</SubmitButton><ErrorText>{state.error}</ErrorText></div>
    </ActionForm>
  );
}

export function VoidCashSale({ id }: { id: string }) {
  const [state, action, pending] = useActionState(voidCashSale, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="flex items-center gap-2">
      <input type="hidden" name="saleId" value={id} />
      <input name="reason" required minLength={3} placeholder="Reason" aria-label="Reason for cancelling" className="w-24 rounded border border-line bg-card px-2 py-1 text-xs" />
      <button className="text-xs text-muted underline hover:text-gave" disabled={pending}>Cancel</button>
      {state.error && <span className="text-xs text-gave">{state.error}</span>}
    </ActionForm>
  );
}

export function AssignCashSale({ id, value, parties }: { id: string; value: string | null; parties: { id: string; name: string }[] }) {
  const f = useRef<HTMLFormElement>(null);
  return (
    <form ref={f} action={assignCashSale}>
      <input type="hidden" name="saleId" value={id} />
      <select name="partyId" defaultValue={value ?? ""} aria-label="Customer" onChange={() => f.current?.requestSubmit()} className="max-w-40 rounded-md border border-line bg-card px-2 py-1 text-xs outline-none focus:border-brand">
        <option value="">No name</option>
        {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </form>
  );
}
