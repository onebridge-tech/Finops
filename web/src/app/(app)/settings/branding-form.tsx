"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { updateBranding } from "@/app/actions/business";
import { ErrorText, Field, Input, Select, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Values = {
  brandColor: string; docTemplate: string; docTerms: string | null; quotePrefix: string;
  bankName: string | null; bankAccountName: string | null; bankAccountNo: string | null; bankIfsc: string | null;
  logoUrl: string | null; signatureUrl: string | null;
};

export function BrandingForm({ values: v }: { values: Values }) {
  const [state, action, pending] = useActionState(updateBranding, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="grid gap-4 sm:grid-cols-2">
      <ImageField name="logo" label="Logo" hint="PNG, JPG or WebP, up to 1 MB" current={v.logoUrl} />
      <ImageField name="signature" label="Signature" hint="Shown above “Authorised signatory”, up to 500 KB" current={v.signatureUrl} />
      <Field label="Brand colour">
        <input type="color" name="brandColor" defaultValue={v.brandColor} className="h-10 w-20 cursor-pointer rounded-lg border border-line bg-card" />
      </Field>
      <Field label="Layout">
        <Select name="docTemplate" defaultValue={v.docTemplate}>
          <option value="CLASSIC">Classic</option>
          <option value="MODERN">Modern (coloured header)</option>
          <option value="COMPACT">Compact</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Field label="Terms printed on invoices and quotations">
          <textarea name="docTerms" rows={3} defaultValue={v.docTerms ?? ""} className={inputClass} placeholder="Goods once sold will not be taken back. Interest at 18% p.a. after due date." />
        </Field>
      </div>
      <Field label="Price quote number starts with"><Input name="quotePrefix" defaultValue={v.quotePrefix} maxLength={10} /></Field>
      <div />
      <Field label="Bank name"><Input name="bankName" defaultValue={v.bankName ?? ""} /></Field>
      <Field label="Account holder name"><Input name="bankAccountName" defaultValue={v.bankAccountName ?? ""} /></Field>
      <Field label="Account number"><Input name="bankAccountNo" inputMode="numeric" defaultValue={v.bankAccountNo ?? ""} /></Field>
      <Field label="IFSC"><Input name="bankIfsc" defaultValue={v.bankIfsc ?? ""} className="uppercase" maxLength={11} /></Field>
      <div className="space-y-3 sm:col-span-2">
        <ErrorText>{state.error}</ErrorText>
        {state.ok && <p className="text-sm text-got">Saved. New and existing documents use this branding.</p>}
        <SubmitButton>Save branding</SubmitButton>
      </div>
    </ActionForm>
  );
}

function ImageField({ name, label, hint, current }: { name: string; label: string; hint: string; current: string | null }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current && <img src={current} alt="" className="h-12 w-auto rounded border border-line bg-white object-contain p-1" />}
        <input type="file" name={name} accept="image/png,image/jpeg,image/webp" className="text-sm" />
      </div>
      {current && (
        <label className="mt-1 flex items-center gap-1 text-xs text-muted">
          <input type="checkbox" name={`remove_${name}`} /> Remove
        </label>
      )}
    </Field>
  );
}
