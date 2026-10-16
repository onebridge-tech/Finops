"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { addPurchaseBill, voidPurchaseBill } from "@/app/actions/purchases";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PAYMENT_MODES, PAYMENT_MODE_LABEL } from "@/lib/format";
import { STATES } from "@/lib/gstin";
import { PURCHASE_KINDS, PURCHASE_KIND_LABEL } from "@/lib/purchase";

type Supplier = { id: string; name: string };

export type Prefill = { txnId: string; date: string; supplier: string; total: string } | null;

export function PurchaseForm({ today, suppliers, businessState, prefill }: { today: string; suppliers: Supplier[]; businessState: string; prefill?: Prefill }) {
  const [state, action, pending] = useActionState(addPurchaseBill, {});
  const form = useRef<HTMLFormElement>(null);
  const [partyId, setPartyId] = useState("");
  const [exact, setExact] = useState(false);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-4">
      <Field label="Supplier" hint="Pick one you already added, or type a new name.">
        <Select name="partyId" value={partyId} onChange={(e) => setPartyId(e.target.value)}><option value="">Someone else…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
      </Field>
      {!partyId ? (
        <>
          <Field label="Supplier name"><Input name="supplierName" maxLength={120} defaultValue={prefill?.supplier} /></Field>
          <Field label="Supplier GSTIN" hint="From the bill. Needed to claim the tax back."><Input name="gstin" maxLength={15} className="uppercase" /></Field>
          <Field label="Supplier state" hint="Used if there is no GSTIN.">
            <Select name="state" defaultValue={businessState}>{Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}</Select>
          </Field>
        </>
      ) : <div className="hidden sm:col-span-3 sm:block" />}
      <Field label="Bill number" hint="The number printed on the supplier’s bill."><Input name="number" required maxLength={40} /></Field>
      <Field label="Bill date"><Input name="date" type="date" defaultValue={prefill?.date || today} max={today} required /></Field>
      {prefill ? (
        <>
          <input type="hidden" name="txnId" value={prefill.txnId} />
          <Field label="Total on the bill (₹)" hint="From your bank statement. We take the GST out for you."><Input name="total" inputMode="decimal" defaultValue={prefill.total} required /></Field>
        </>
      ) : (
        <Field label="Taxable value (₹)" hint="The amount before GST."><Input name="taxable" inputMode="decimal" required /></Field>
      )}
      {!exact ? (
        <Field label="GST rate" hint="We work out CGST, SGST or IGST for you.">
          <Select name="rate" defaultValue="18">{[0, 0.25, 3, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</Select>
        </Field>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:col-span-1">
          <Field label="CGST ₹"><Input name="cgst" inputMode="decimal" /></Field>
          <Field label="SGST ₹"><Input name="sgst" inputMode="decimal" /></Field>
          <Field label="IGST ₹"><Input name="igst" inputMode="decimal" /></Field>
        </div>
      )}
      <Field label="What was bought">
        <Select name="kind" defaultValue="GOODS">{PURCHASE_KINDS.map((k) => <option key={k} value={k}>{PURCHASE_KIND_LABEL[k]}</option>)}</Select>
      </Field>
      <Field label="Note"><Input name="note" maxLength={200} /></Field>
      <div className="space-y-2 text-sm sm:col-span-4">
        <label className="flex items-start gap-2"><input type="checkbox" name="itcEligible" defaultChecked className="mt-0.5 size-4 accent-[var(--brand)]" /><span>I can claim the GST on this bill back (input tax credit)<span className="block text-xs text-muted">Needs the supplier’s GSTIN. Tick it for business purchases; leave it off for things like personal use or food.</span></span></label>
        <label className="flex items-start gap-2"><input type="checkbox" name="alsoExpense" defaultChecked className="mt-0.5 size-4 accent-[var(--brand)]" /><span>Also add this to my shop expenses<span className="block text-xs text-muted">So the cost counts in your profit. Turn it off if you already wrote it as an expense.</span></span></label>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2">Paid by
            <Select name="paymentMode" defaultValue="BANK" className="min-h-8 w-auto py-1">{PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}</Select>
          </label>
          <button type="button" className="text-brand underline" onClick={() => setExact((v) => !v)}>{exact ? "Use a GST rate instead" : "The bill has different tax amounts? Type them in"}</button>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:col-span-4"><SubmitButton>Add bill</SubmitButton><ErrorText>{state.error}</ErrorText></div>
    </ActionForm>
  );
}

export function VoidPurchase({ id }: { id: string }) {
  const [state, action, pending] = useActionState(voidPurchaseBill, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="flex items-center gap-2">
      <input type="hidden" name="billId" value={id} />
      <input name="reason" required minLength={3} placeholder="Reason" aria-label="Reason for voiding" className="w-28 rounded border border-line bg-card px-2 py-1 text-xs" />
      <button className="text-xs text-muted underline hover:text-gave" disabled={pending}>Cancel bill</button>
      {state.error && <span className="text-xs text-gave">{state.error}</span>}
    </ActionForm>
  );
}
