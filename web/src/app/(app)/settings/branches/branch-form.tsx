"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { saveBranch } from "@/app/actions/team";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function BranchForm({ branch }: { branch?: { id: string; name: string; address: string; phone: string; gstin: string; invoicePrefix: string } }) {
  const [state, action, pending] = useActionState(saveBranch, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !branch) form.current?.reset();
  }, [state, branch]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-3">
      {branch && <input type="hidden" name="branchId" value={branch.id} />}
      <Field label="Name"><Input name="name" required defaultValue={branch?.name} placeholder="Kukatpally shop" /></Field>
      <Field label="Address"><Input name="address" defaultValue={branch?.address} /></Field>
      <Field label="Phone"><Input name="phone" inputMode="tel" defaultValue={branch?.phone} /></Field>
      <Field label="Branch GSTIN" hint="Only if this branch has its own GST number. Bills from this branch will show it instead of the main one."><Input name="gstin" maxLength={15} className="uppercase" defaultValue={branch?.gstin} /></Field>
      <Field label="Bill number series" hint="Give this branch its own bill numbers, for example KPY-0001, so branches never mix up. Leave empty to share the main series."><Input name="invoicePrefix" maxLength={10} defaultValue={branch?.invoicePrefix} /></Field>
      <div className="space-y-2 sm:col-span-3">
        <ErrorText>{state.error}</ErrorText>
        {state.info && <p className="text-sm text-got">{state.info}</p>}
        <SubmitButton variant={branch ? "secondary" : "primary"}>{branch ? "Save" : "Add branch"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
