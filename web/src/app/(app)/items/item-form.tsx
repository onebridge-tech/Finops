"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState, useEffect, useRef } from "react";
import { createItem } from "@/app/actions/billing";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { GST_RATES_BP } from "@/lib/gst";

export function ItemForm() {
  const [state, action, pending] = useActionState(createItem, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-6">
      <div className="sm:col-span-2"><Field label="Item name"><Input name="name" required /></Field></div>
      <Field label="Price (₹, excl. GST)"><Input name="price" inputMode="decimal" required /></Field>
      <Field label="GST rate">
        <Select name="taxRateBp" defaultValue="1800">
          {GST_RATES_BP.map((r) => <option key={r} value={r}>{r / 100}%</option>)}
        </Select>
      </Field>
      <Field label="HSN/SAC"><Input name="hsn" inputMode="numeric" /></Field>
      <Field label="Unit"><Input name="unit" defaultValue="pcs" required /></Field>
      <input type="hidden" name="sku" value="" />
      <div className="space-y-2 sm:col-span-6">
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton>Add item</SubmitButton>
      </div>
    </ActionForm>
  );
}
