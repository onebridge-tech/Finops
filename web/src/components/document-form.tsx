"use client";

import { ActionForm } from "./action-form";
import { useActionState, useMemo, useState } from "react";
import { createInvoice, createQuote } from "@/app/actions/billing";
import { createOrder } from "@/app/actions/orders";
import { createDebitNote } from "@/app/actions/notes";
import { Card, ErrorText, Field, Input, Select, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import { CreditWarning } from "./credit-warning";
import { computeInvoice, GST_RATES_BP, isInterState } from "@/lib/gst";
import { formatINR, parseRupees, toRupeeString } from "@/lib/money";
import { STATES } from "@/lib/gstin";
import { priceFor, type PriceRow } from "@/lib/rules";

export type DocKind = "INVOICE" | "QUOTE" | "SALES_ORDER" | "PURCHASE_ORDER" | "DEBIT_NOTE";

type PartyOpt = { id: string; name: string; stateCode: string; creditDays: number | null };
type ItemOpt = { id: string; name: string; hsn: string; unit: string; ratePaise: number; taxRateBp: number };
type Line = { key: number; itemId: string; description: string; hsn: string; unit: string; qty: string; rate: string; manual: boolean; discount: string; taxRateBp: number };

const TEXT: Record<DocKind, { party: string; state: string; date: string; due: string | null; dueHint?: string; submit: string; notes: string }> = {
  INVOICE: { party: "Customer", state: "Place of supply", date: "Invoice date", due: "Due date", dueHint: "Blank = customer’s credit days", submit: "Create invoice", notes: "Notes / terms" },
  QUOTE: { party: "Customer", state: "Place of supply", date: "Quotation date", due: "Valid until", dueHint: "Optional", submit: "Create quotation", notes: "Notes / terms" },
  SALES_ORDER: { party: "Customer", state: "Place of supply", date: "Order date", due: "Expected delivery", dueHint: "Optional", submit: "Create order", notes: "Notes" },
  PURCHASE_ORDER: { party: "Supplier", state: "Supplier’s state", date: "Order date", due: "Expected delivery", dueHint: "Optional", submit: "Create purchase order", notes: "Notes" },
  DEBIT_NOTE: { party: "Party", state: "Place of supply", date: "Note date", due: null, submit: "Create debit note", notes: "Reason (required)" },
};

let nextKey = 1;
const blank = (): Line => ({ key: nextKey++, itemId: "", description: "", hsn: "", unit: "pcs", qty: "1", rate: "", manual: false, discount: "", taxRateBp: 1800 });

/** Line-item editor shared by GST invoices, quotations, orders and debit notes. */
export function DocumentForm({ kind, parties, items, businessState, today, preselect, priceRows = {} }: {
  kind: DocKind; parties: PartyOpt[]; items: ItemOpt[]; businessState: string; today: string; preselect: string;
  priceRows?: Record<string, PriceRow[]>; // rates on each party's price list (CI-03)
}) {
  const t = TEXT[kind];
  const action_ = kind === "QUOTE" ? createQuote : kind === "INVOICE" ? createInvoice : kind === "DEBIT_NOTE" ? createDebitNote : createOrder;
  const [state, action, pending] = useActionState(action_, {});
  const initial = parties.find((p) => p.id === preselect) ?? parties[0];
  const [partyId, setPartyId] = useState(initial.id);
  const [pos, setPos] = useState(initial.stateCode);
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);

  /** The rate a line should have for this party: their price list slab, else the item's standard price. */
  const autoRate = (l: Line, party: string, qty = l.qty) => {
    const it = items.find((i) => i.id === l.itemId);
    if (!it) return l.rate;
    return toRupeeString(priceFor(priceRows[party] ?? [], it.id, Math.round((Number(qty) || 0) * 1000), it.ratePaise));
  };
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const setQty = (l: Line, qty: string) => update(l.key, { qty, ...(l.manual || !l.itemId ? {} : { rate: autoRate(l, partyId, qty) }) });
  const pickParty = (id: string) => {
    const p = parties.find((x) => x.id === id)!;
    setPartyId(p.id);
    setPos(p.stateCode);
    setLines((ls) => ls.map((l) => (l.manual || !l.itemId ? l : { ...l, rate: autoRate(l, p.id) })));
  };
  const hasList = (priceRows[partyId] ?? []).length > 0;

  const interState = isInterState(businessState, pos);
  const totals = useMemo(() => {
    const valid = lines.map((l) => ({
      description: l.description,
      qtyMilli: Math.round((Number(l.qty) || 0) * 1000),
      ratePaise: parseRupees(l.rate) ?? 0,
      taxRateBp: l.taxRateBp,
      discountBp: Math.round((Number(l.discount) || 0) * 100),
    }));
    return computeInvoice(valid, interState);
  }, [lines, interState]);

  const payload = JSON.stringify({
    partyId, date, dueDate, placeOfSupply: pos, notes,
    lines: lines.map(({ itemId, description, hsn, unit, qty, rate, discount, taxRateBp }) => ({ itemId: itemId || undefined, description, hsn, unit, qty, rate, discount, taxRateBp })),
  });

  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />
      {(kind === "SALES_ORDER" || kind === "PURCHASE_ORDER") && <input type="hidden" name="orderKind" value={kind === "SALES_ORDER" ? "SALES" : "PURCHASE"} />}
      <Card className="grid gap-3 sm:grid-cols-4">
        <Field label={t.party} hint={hasList ? "Price list rates apply" : undefined}>
          <Select value={partyId} onChange={(e) => pickParty(e.target.value)}>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label={t.state} hint={interState ? "Inter-state → IGST" : "Intra-state → CGST + SGST"}>
          <Select value={pos} onChange={(e) => setPos(e.target.value)}>
            {Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
          </Select>
        </Field>
        <Field label={t.date}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        {t.due && <Field label={t.due} hint={t.dueHint}><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>}
      </Card>

      <Card className="space-y-3">
        {lines.map((l, idx) => {
          const tl = totals.lines[idx];
          return (
            <div key={l.key} className="grid gap-2 border-b border-line pb-3 last:border-0 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label className="text-sm text-muted">Item / description</label>
                {items.length > 0 && (
                  <select className={`${inputClass} mb-1`} value={l.itemId} onChange={(e) => {
                    const it = items.find((i) => i.id === e.target.value);
                    if (!it) return update(l.key, { itemId: "" });
                    const picked = { ...l, itemId: it.id, manual: false };
                    update(l.key, { itemId: it.id, description: it.name, hsn: it.hsn, unit: it.unit, rate: autoRate(picked, partyId), manual: false, taxRateBp: it.taxRateBp });
                  }}>
                    <option value="">Custom line…</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                )}
                <input className={inputClass} placeholder="Description" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} required />
              </div>
              <div className="sm:col-span-1"><label className="text-sm text-muted">HSN/SAC</label><input className={inputClass} value={l.hsn} onChange={(e) => update(l.key, { hsn: e.target.value })} /></div>
              <div className="sm:col-span-1"><label className="text-sm text-muted">Qty</label><input className={inputClass} inputMode="decimal" value={l.qty} onChange={(e) => setQty(l, e.target.value)} /></div>
              <div className="sm:col-span-2">
                <label className="text-sm text-muted">Rate (₹){l.itemId && !l.manual && hasList && <span className="ml-1 text-brand">list</span>}</label>
                <input className={inputClass} inputMode="decimal" value={l.rate} onChange={(e) => update(l.key, { rate: e.target.value, manual: true })} required />
              </div>
              <div className="sm:col-span-1"><label className="text-sm text-muted">Discount %</label><input className={inputClass} inputMode="decimal" value={l.discount} onChange={(e) => update(l.key, { discount: e.target.value })} /></div>
              <div className="sm:col-span-1">
                <label className="text-sm text-muted">GST</label>
                <select className={inputClass} value={l.taxRateBp} onChange={(e) => update(l.key, { taxRateBp: Number(e.target.value) })}>
                  {GST_RATES_BP.map((r) => <option key={r} value={r}>{r / 100}%</option>)}
                </select>
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-2 sm:flex-col sm:items-end">
                <span className="text-base font-medium tabular-nums">{formatINR(tl?.total ?? 0)}</span>
                {lines.length > 1 && (
                  <button type="button" className="text-sm text-muted hover:text-gave" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Remove</button>
                )}
              </div>
            </div>
          );
        })}
        <button type="button" className="text-base font-medium text-brand" onClick={() => setLines((ls) => [...ls, blank()])}>+ Add line</button>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Field label={t.notes}><textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} required={kind === "DEBIT_NOTE"} /></Field>
        </Card>
        <Card className="space-y-1 text-base">
          <Row label="Amount before GST" value={totals.taxable} />
          {interState ? <Row label="IGST" value={totals.igst} /> : (<><Row label="CGST" value={totals.cgst} /><Row label="SGST" value={totals.sgst} /></>)}
          <Row label="Round off" value={totals.roundOff} />
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatINR(totals.total)}</span></div>
        </Card>
      </div>

      <CreditWarning reasons={state.warning} pending={pending} />
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton>{t.submit}</SubmitButton>
    </ActionForm>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className="tabular-nums">{formatINR(value)}</span></div>;
}
