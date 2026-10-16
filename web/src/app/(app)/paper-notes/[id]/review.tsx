"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { discardNote, saveNote, type NoteState } from "@/app/actions/paper-notes";
import { Card, ErrorText, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icon";
import { formatINR } from "@/lib/money";

type Row = { date: string; item: string; qty: number | null; amountPaise: number; type: "IN" | "OUT"; confidence: number };
type Edit = { key: number; include: boolean; date: string; item: string; qty: string; amount: string; type: "IN" | "OUT"; mode: string; category: string; unsure: boolean };

export function NoteReview({ scanId, initial, categories, today }: { scanId: string; initial: Row[]; categories: string[]; today: string }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(saveNote, {});
  const [rows, setRows] = useState<Edit[]>(() =>
    initial.map((r, i) => ({ key: i, include: r.confidence >= 0.4, date: r.date, item: r.item, qty: r.qty === null ? "" : String(r.qty), amount: String(r.amountPaise / 100), type: r.type, mode: "CASH", category: "Other", unsure: r.confidence < 0.7 })),
  );
  const [next, setNext] = useState(initial.length);
  const set = (key: number, patch: Partial<Edit>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const kept = rows.filter((r) => r.include);
  const sum = (t: "IN" | "OUT") => kept.filter((r) => r.type === t).reduce((s, r) => s + Math.round((Number(r.amount) || 0) * 100), 0);

  return (
    <div className="space-y-4">
      <Card className="p-0 sm:p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm">
          <span className="font-medium">{rows.length} line{rows.length === 1 ? "" : "s"} read</span>
          <button type="button" className="flex items-center gap-1 text-brand underline" onClick={() => { setRows((r) => [...r, { key: next, include: true, date: today, item: "", qty: "", amount: "", type: "IN", mode: "CASH", category: "Other", unsure: false }]); setNext(next + 1); }}><Icon name="plus" size={14} />Add a line</button>
        </div>
        {rows.length === 0 && <p className="px-4 py-4 text-sm text-muted">No lines were read. You can add them by hand with “Add a line”.</p>}
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.key} className={`grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_6rem_7rem_7rem] ${r.include ? "" : "opacity-50"}`}>
              <input type="checkbox" checked={r.include} onChange={(e) => set(r.key, { include: e.target.checked })} className="mt-2 size-4 accent-[var(--brand)]" aria-label="Keep this line" />
              <div className="space-y-1">
                <Input value={r.item} onChange={(e) => set(r.key, { item: e.target.value })} aria-label="Item" placeholder="Item" maxLength={120} />
                {r.unsure && <p className="flex items-center gap-1 text-xs text-warn"><Icon name="warning" size={12} />Not sure about this one. Please check it.</p>}
              </div>
              <Input value={r.qty} onChange={(e) => set(r.key, { qty: e.target.value })} aria-label="Quantity" placeholder="Qty" inputMode="decimal" />
              <Input value={r.amount} onChange={(e) => set(r.key, { amount: e.target.value })} aria-label="Amount in rupees" placeholder="₹" inputMode="decimal" />
              <Select value={r.type} onChange={(e) => set(r.key, { type: e.target.value as "IN" | "OUT" })} aria-label="Money in or out" className={r.type === "IN" ? "text-got" : "text-gave"}>
                <option value="IN">Money in (sale)</option>
                <option value="OUT">Money out</option>
              </Select>
              <div className="flex flex-wrap gap-2 sm:col-start-2 sm:col-span-4">
                <Input type="date" value={r.date} max={today} onChange={(e) => set(r.key, { date: e.target.value })} aria-label="Date" className="w-auto" />
                <Select value={r.mode} onChange={(e) => set(r.key, { mode: e.target.value })} aria-label="Paid by" className="w-auto">
                  <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK">Bank</option><option value="CARD">Card</option>
                </Select>
                {r.type === "OUT" && (
                  <Select value={r.category} onChange={(e) => set(r.key, { category: e.target.value })} aria-label="Expense category" className="w-auto">
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <ActionForm dispatch={action} pending={pending} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="scanId" value={scanId} />
        <input type="hidden" name="rows" value={JSON.stringify(rows.map(({ include, date, item, qty, amount, type, mode, category }) => ({ include, date, item, qty, amount, type, mode, category })))} />
        <SubmitButton>Save {kept.length} line{kept.length === 1 ? "" : "s"}</SubmitButton>
        <span className="text-sm text-muted">Money in {formatINR(sum("IN"))} · money out {formatINR(sum("OUT"))}</span>
        <ErrorText>{state.error}</ErrorText>
      </ActionForm>
      <form action={discardNote}>
        <input type="hidden" name="scanId" value={scanId} />
        <button className="text-sm text-muted underline hover:text-gave">Throw this page away without saving</button>
      </form>
    </div>
  );
}
