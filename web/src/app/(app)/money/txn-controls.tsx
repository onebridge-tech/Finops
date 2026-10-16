"use client";

import { useRef } from "react";
import { addToExpenses, recordCustomerPayment, setCategory } from "@/app/actions/money";
import { buttonClass } from "@/components/ui";

/** Changes the group of one transaction as soon as a new one is picked. */
export function CategorySelect({ id, value, options, disabled }: { id: string; value: string; options: string[]; disabled?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setCategory}>
      <input type="hidden" name="id" value={id} />
      <select
        name="category" defaultValue={value} disabled={disabled} aria-label="Group"
        onChange={() => form.current?.requestSubmit()}
        className="max-w-48 rounded-md border border-line bg-card px-2 py-1 text-sm outline-none focus:border-brand disabled:opacity-60"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </form>
  );
}

/** What can be done with one line: put spending into expenses, or write a customer's payment. */
export function TxnActions({ id, direction, parties, suggestion, billHref }: { id: string; direction: "IN" | "OUT"; parties: { id: string; name: string }[]; suggestion: string | null; billHref?: string }) {
  if (direction === "OUT") {
    return (
      <div className="flex flex-col items-end gap-1">
        <form action={addToExpenses}>
          <input type="hidden" name="id" value={id} />
          <button className="text-sm font-medium text-brand hover:underline">Add to expenses</button>
        </form>
        {billHref && <a href={billHref} className="text-xs text-muted underline hover:text-ink">I have the supplier’s bill</a>}
      </div>
    );
  }
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-sm font-medium text-brand hover:underline">Record customer payment</summary>
      <form action={recordCustomerPayment} className="absolute right-0 z-10 mt-1 w-64 space-y-2 rounded-xl border border-line bg-card p-3 text-left shadow-[var(--shadow-lg)]">
        <input type="hidden" name="id" value={id} />
        <label className="block text-xs font-medium text-muted">Which customer paid?</label>
        <select name="partyId" defaultValue={suggestion ?? ""} required className="w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm">
          <option value="" disabled>Choose a customer</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className={buttonClass("primary", "w-full")}>Write it in their account</button>
        <p className="text-xs text-muted">Their pending amount goes down by this payment.</p>
      </form>
    </details>
  );
}
