"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { addExpense, voidExpense } from "@/app/actions/cash";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PAYMENT_MODES, PAYMENT_MODE_LABEL } from "@/lib/format";

type Opt = { id: string; name: string };

export function ExpenseForm({ today, categories, vendors, branches }: { today: string; categories: string[]; vendors: Opt[]; branches: Opt[] | null }) {
  const [state, action, pending] = useActionState(addExpense, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-4">
      <Field label="Date"><Input name="date" type="date" defaultValue={today} max={today} required /></Field>
      <Field label="Amount (₹)"><Input name="amount" inputMode="decimal" required /></Field>
      <Field label="Category">
        <Input name="category" list="expense-categories" required placeholder="Rent, Transport…" />
        <datalist id="expense-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="Paid by">
        <Select name="paymentMode" defaultValue="CASH">{PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}</Select>
      </Field>
      <Field label="Supplier" hint="Optional">
        <Select name="vendorId" defaultValue=""><option value="">None</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select>
      </Field>
      {branches ? (
        <Field label="Branch"><Select name="branchId" defaultValue=""><option value="">Default</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
      ) : <input type="hidden" name="branchId" value="" />}
      <Field label="Note"><Input name="note" /></Field>
      <Field label="Receipt photo" hint="Optional"><input name="receipt" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="text-sm" /></Field>
      <div className="flex items-center gap-3 sm:col-span-4"><SubmitButton>Add expense</SubmitButton><ErrorText>{state.error}</ErrorText></div>
    </ActionForm>
  );
}

export function VoidExpense({ id }: { id: string }) {
  const [state, action, pending] = useActionState(voidExpense, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="flex items-center gap-2">
      <input type="hidden" name="expenseId" value={id} />
      <input name="reason" required minLength={3} placeholder="Reason" aria-label="Reason for voiding" className="w-28 rounded border border-line bg-card px-2 py-1 text-xs" />
      <button className="text-xs text-muted underline hover:text-gave" disabled={pending}>Cancel</button>
      {state.error && <span className="text-xs text-gave">{state.error}</span>}
    </ActionForm>
  );
}
