"use client";

import { ActionForm } from "./action-form";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/business";
import { ErrorText, Field, Input, Select } from "./ui";
import { SubmitButton } from "./submit-button";
import { STATES } from "@/lib/gstin";
import { GstinLookupButton } from "./gstin-lookup";

type Values = { name?: string; gstin?: string | null; stateCode?: string; address?: string | null; phone?: string | null; email?: string | null; upiId?: string | null; invoicePrefix?: string };

export function BusinessForm({ action, values = {}, submitLabel }: { action: (s: FormState, f: FormData) => Promise<FormState>; values?: Values; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <ActionForm dispatch={formAction} pending={pending} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Shop name">
          <Input name="name" defaultValue={values.name} required placeholder="Sri Sai Traders" />
        </Field>
      </div>
      <Field label="GSTIN (optional)" hint="15 characters. The state is taken from the first two digits.">
        <span className="flex flex-wrap gap-2">
          <Input name="gstin" defaultValue={values.gstin ?? ""} placeholder="36AAACB1234C1Z5" className="flex-1 uppercase" maxLength={15}
          onChange={(e) => {
            const code = e.currentTarget.value.slice(0, 2);
            const sel = e.currentTarget.form?.elements.namedItem("stateCode") as HTMLSelectElement | null;
            if (sel && code in STATES) sel.value = code;
          }} />
          <GstinLookupButton />
        </span>
      </Field>
      <Field label="State">
        <Select name="stateCode" defaultValue={values.stateCode ?? "36"} required>
          {Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Address">
          <Input name="address" defaultValue={values.address ?? ""} placeholder="Shop no., street, city, PIN" />
        </Field>
      </div>
      <Field label="Shop phone"><Input name="phone" defaultValue={values.phone ?? ""} inputMode="tel" /></Field>
      <Field label="Email"><Input name="email" type="email" defaultValue={values.email ?? ""} /></Field>
      <Field label="UPI ID for collections" hint="Customers pay to this ID from reminders, statements and invoices.">
        <Input name="upiId" defaultValue={values.upiId ?? ""} placeholder="yourshop@okicici" />
      </Field>
      <Field label="Bill number starts with"><Input name="invoicePrefix" defaultValue={values.invoicePrefix ?? "INV-"} maxLength={10} /></Field>
      <div className="space-y-3 sm:col-span-2">
        <ErrorText>{state.error}</ErrorText>
        {state.ok && <p className="text-base text-got">Saved.</p>}
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
