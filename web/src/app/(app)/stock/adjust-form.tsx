"use client";

import { useActionState, useEffect, useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { adjustStock } from "@/app/actions/catalog";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function AdjustStockForm({ items, selected }: { items: { id: string; name: string }[]; selected: string }) {
  const [state, action, pending] = useActionState(adjustStock, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-4">
      <Field label="Item"><Select name="itemId" defaultValue={selected || items[0]?.id}>{items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>
      <Field label="Change" hint="+10 adds, -2 removes"><Input name="qty" inputMode="decimal" required /></Field>
      <div className="sm:col-span-2"><Field label="Why"><Input name="note" required placeholder="Physical count / damaged / found" /></Field></div>
      <div className="flex items-center gap-3 sm:col-span-4"><SubmitButton variant="secondary">Record adjustment</SubmitButton><ErrorText>{state.error}</ErrorText>{state.info && <span className="text-base text-got">{state.info}</span>}</div>
    </ActionForm>
  );
}
