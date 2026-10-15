"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { createPriceList, fillPriceList, setPriceRow } from "@/app/actions/catalog";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function NewListForm() {
  const [state, action, pending] = useActionState(createPriceList, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="flex flex-wrap items-end gap-3">
      <Field label="New special price list"><Input name="name" required placeholder="Dealer / Distributor / Retail" /></Field>
      <SubmitButton>Create</SubmitButton>
      <ErrorText>{state.error}</ErrorText>
    </ActionForm>
  );
}

export function RateForm({ listId, items }: { listId: string; items: { id: string; name: string; price: string }[] }) {
  const [state, action, pending] = useActionState(setPriceRow, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="listId" value={listId} />
      <Field label="Item"><Select name="itemId">{items.map((i) => <option key={i.id} value={i.id}>{i.name} (standard {i.price})</option>)}</Select></Field>
      <Field label="Rate (₹)"><Input name="rate" inputMode="decimal" required /></Field>
      <Field label="From quantity" hint="0 means this rate applies to any quantity. 50 means the rate applies when the customer buys 50 or more."><Input name="minQty" inputMode="decimal" defaultValue="0" /></Field>
      <div className="flex items-end gap-3"><SubmitButton variant="secondary">Save rate</SubmitButton></div>
      <div className="sm:col-span-4"><ErrorText>{state.error}</ErrorText></div>
    </ActionForm>
  );
}

export function FillForm({ listId }: { listId: string }) {
  const [state, action, pending] = useActionState(fillPriceList, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="listId" value={listId} />
      <Field label="Fill from standard prices, less %" hint="Sets every item; you can change rates after"><Input name="pct" inputMode="decimal" placeholder="10" className="w-28" /></Field>
      <SubmitButton variant="secondary">Fill list</SubmitButton>
      <ErrorText>{state.error}</ErrorText>
      {state.info && <span className="text-sm text-got">{state.info}</span>}
    </ActionForm>
  );
}
