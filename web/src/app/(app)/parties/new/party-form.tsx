"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState } from "react";
import { createParty } from "@/app/actions/ledger";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { STATES } from "@/lib/gstin";
import { LANGUAGE_NAMES } from "@/lib/messaging/templates";

export function PartyForm({ defaultState }: { defaultState: string }) {
  const [state, action, pending] = useActionState(createParty, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Name"><Input name="name" required autoFocus placeholder="Lakshmi General Stores" /></Field>
      </div>
      <Field label="Type">
        <Select name="type" defaultValue="CUSTOMER">
          <option value="CUSTOMER">Customer</option>
          <option value="SUPPLIER">Supplier</option>
          <option value="BOTH">Customer & supplier</option>
        </Select>
      </Field>
      <Field label="Mobile (for WhatsApp reminders)"><Input name="phone" inputMode="tel" placeholder="98480 12345" /></Field>
      <Field label="GSTIN (optional)"><Input name="gstin" maxLength={15} className="uppercase" /></Field>
      <Field label="State" hint="Used for place of supply on invoices.">
        <Select name="stateCode" defaultValue={defaultState}>
          {Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
        </Select>
      </Field>
      <Field label="Email"><Input name="email" type="email" /></Field>
      <Field label="Credit days" hint="Default due date for credit you give.">
        <Input name="creditDays" inputMode="numeric" placeholder="30" />
      </Field>
      <Field label="Reminder language">
        <Select name="language" defaultValue="en">
          {Object.entries(LANGUAGE_NAMES).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </Select>
      </Field>
      <Field label="Source" hint="Walk-in, referral, trade show, website…"><Input name="source" /></Field>
      <div className="sm:col-span-2"><Field label="Address"><Input name="address" /></Field></div>
      <Field label="Opening balance (₹)"><Input name="opening" inputMode="decimal" placeholder="0" /></Field>
      <Field label="Opening balance is">
        <Select name="openingDirection" defaultValue="GAVE">
          <option value="GAVE">They owe me</option>
          <option value="GOT">I owe them</option>
        </Select>
      </Field>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-[var(--brand)]" />
        <span>
          This party agreed to receive account messages (reminders, receipts, invoices) on WhatsApp, SMS or email.
          <span className="block text-xs text-muted">Required before the app can message them. They can stop messages at any time from a link in each message.</span>
        </span>
      </label>
      <div className="space-y-3 sm:col-span-2">
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton>Save party</SubmitButton>
      </div>
    </ActionForm>
  );
}
