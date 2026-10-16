"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { matchStatementPayments, type MatchState } from "@/app/actions/money";
import { Card, ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatINR } from "@/lib/money";

type Row = { id: string; date: string; description: string; counterparty: string | null; amountPaise: number; suggestion: string | null };

export function MatchForm({ rows, parties }: { rows: Row[]; parties: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<MatchState, FormData>(matchStatementPayments, {});
  const [mode, setMode] = useState<"PAYMENT" | "BILL">("PAYMENT");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rows.filter((r) => r.suggestion).map((r) => r.id)));
  const total = rows.filter((r) => picked.has(r.id)).reduce((s, r) => s + r.amountPaise, 0);
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-5">
      <Card className="p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5 text-sm">
          <span className="text-muted">{rows.filter((r) => r.suggestion).length} of {rows.length} lines have a likely customer. Check each one.</span>
          <span className="flex gap-3 text-xs">
            <button type="button" className="text-brand underline" onClick={() => setPicked(new Set(rows.map((r) => r.id)))}>Tick all</button>
            <button type="button" className="text-brand underline" onClick={() => setPicked(new Set())}>Untick all</button>
          </span>
        </div>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <input type="checkbox" name="pick" value={r.id} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[var(--brand)]" aria-label={`Record ${r.description}`} />
              <span className="w-14 shrink-0 text-xs text-muted">{r.date.slice(8)}/{r.date.slice(5, 7)}</span>
              <span className="min-w-0 flex-1 basis-48"><span className="block truncate text-sm font-medium" title={r.description}>{r.description}</span>{r.counterparty && <span className="text-xs text-muted">{r.counterparty}</span>}</span>
              <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-got">{formatINR(r.amountPaise)}</span>
              <Select name={`party_${r.id}`} defaultValue={r.suggestion ?? ""} aria-label="Customer" className="w-full sm:w-56">
                <option value="">Choose a customer</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 text-sm">
        <p className="font-semibold">What should we do with the {picked.size} ticked line{picked.size === 1 ? "" : "s"} ({formatINR(total)})?</p>
        <label className="flex items-start gap-2"><input type="radio" name="mode" value="PAYMENT" checked={mode === "PAYMENT"} onChange={() => setMode("PAYMENT")} className="mt-1 accent-[var(--brand)]" /><span><span className="font-medium">Write each as a payment, with a receipt</span><span className="block text-xs text-muted">For money against bills or credit that is already in the app. The customer’s pending amount goes down.</span></span></label>
        <label className="flex items-start gap-2"><input type="radio" name="mode" value="BILL" checked={mode === "BILL"} onChange={() => setMode("BILL")} className="mt-1 accent-[var(--brand)]" /><span><span className="font-medium">Also make a GST bill for each, because these sales were never billed</span><span className="block text-xs text-muted">A bill is a tax document, so only use this for real sales. The payment settles the bill.</span></span></label>
        {mode === "BILL" && (
          <div className="grid gap-3 rounded-lg border border-line bg-bg p-3 sm:grid-cols-4">
            <div className="sm:col-span-2"><Field label="What was sold" hint="Shown on every bill made now."><Input name="billItem" defaultValue="Goods supplied" maxLength={120} /></Field></div>
            <Field label="GST rate" hint="The payment includes this GST."><Select name="billGst" defaultValue="18">{[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}</Select></Field>
            <Field label="HSN/SAC" hint="Optional"><Input name="billHsn" inputMode="numeric" maxLength={8} /></Field>
            <label className="flex items-start gap-2 text-xs sm:col-span-4"><input type="checkbox" name="confirmSales" className="mt-0.5 size-4 accent-[var(--brand)]" /><span>I confirm these were real sales that have not been billed yet. Bills cannot be removed once made, only cancelled with a reason.</span></label>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{mode === "BILL" ? `Make ${picked.size} bills and record payments` : `Record ${picked.size} payments`}</SubmitButton>
        <ErrorText>{state.error}</ErrorText>
        {state.ok && <p role="status" className="text-sm font-medium text-got">{state.ok}</p>}
      </div>
    </ActionForm>
  );
}
