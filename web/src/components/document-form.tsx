"use client";

import { ActionForm } from "./action-form";
import { useActionState, useMemo, useState } from "react";
import { createInvoice, createQuote } from "@/app/actions/billing";
import { Card, ErrorText, Field, Input, Select, inputClass } from "./ui";
import { SubmitButton } from "./submit-button";
import { computeInvoice, GST_RATES_BP, isInterState } from "@/lib/gst";
import { formatINR, parseRupees, toRupeeString } from "@/lib/money";
import { STATES } from "@/lib/gstin";

type PartyOpt = { id: string; name: string; stateCode: string; creditDays: number | null };
type ItemOpt = { id: string; name: string; hsn: string; unit: string; ratePaise: number; taxRateBp: number };
type Line = { key: number; itemId: string; description: string; hsn: string; unit: string; qty: string; rate: string; discount: string; taxRateBp: number };

let nextKey = 1;
const blank = (): Line => ({ key: nextKey++, itemId: "", description: "", hsn: "", unit: "pcs", qty: "1", rate: "", discount: "", taxRateBp: 1800 });

/** Line-item editor shared by GST invoices and quotations. */
export function DocumentForm({ kind, parties, items, businessState, today, preselect }: { kind: "INVOICE" | "QUOTE"; parties: PartyOpt[]; items: ItemOpt[]; businessState: string; today: string; preselect: string }) {
  const isQuote = kind === "QUOTE";
  const [state, action, pending] = useActionState(isQuote ? createQuote : createInvoice, {});
  const initial = parties.find((p) => p.id === preselect) ?? parties[0];
  const [partyId, setPartyId] = useState(initial.id);
  const [pos, setPos] = useState(initial.stateCode);
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blank()]);

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

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
      <Card className="grid gap-3 sm:grid-cols-4">
        <Field label="Customer">
          <Select value={partyId} onChange={(e) => {
            const p = parties.find((x) => x.id === e.target.value)!;
            setPartyId(p.id);
            setPos(p.stateCode);
          }}>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Place of supply" hint={interState ? "Inter-state → IGST" : "Intra-state → CGST + SGST"}>
          <Select value={pos} onChange={(e) => setPos(e.target.value)}>
            {Object.entries(STATES).map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
          </Select>
        </Field>
        <Field label={isQuote ? "Quotation date" : "Invoice date"}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label={isQuote ? "Valid until" : "Due date"} hint={isQuote ? "Optional" : "Blank = customer’s credit days"}><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      </Card>

      <Card className="space-y-3">
        {lines.map((l, idx) => {
          const t = totals.lines[idx];
          return (
            <div key={l.key} className="grid gap-2 border-b border-line pb-3 last:border-0 sm:grid-cols-12">
              <div className="sm:col-span-4">
                <label className="text-xs text-muted">Item / description</label>
                {items.length > 0 && (
                  <select className={`${inputClass} mb-1`} value={l.itemId} onChange={(e) => {
                    const it = items.find((i) => i.id === e.target.value);
                    update(l.key, it
                      ? { itemId: it.id, description: it.name, hsn: it.hsn, unit: it.unit, rate: toRupeeString(it.ratePaise), taxRateBp: it.taxRateBp }
                      : { itemId: "" });
                  }}>
                    <option value="">Custom line…</option>
                    {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                )}
                <input className={inputClass} placeholder="Description" value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} required />
              </div>
              <div className="sm:col-span-1"><label className="text-xs text-muted">HSN/SAC</label><input className={inputClass} value={l.hsn} onChange={(e) => update(l.key, { hsn: e.target.value })} /></div>
              <div className="sm:col-span-1"><label className="text-xs text-muted">Qty</label><input className={inputClass} inputMode="decimal" value={l.qty} onChange={(e) => update(l.key, { qty: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="text-xs text-muted">Rate (₹)</label><input className={inputClass} inputMode="decimal" value={l.rate} onChange={(e) => update(l.key, { rate: e.target.value })} required /></div>
              <div className="sm:col-span-1"><label className="text-xs text-muted">Disc %</label><input className={inputClass} inputMode="decimal" value={l.discount} onChange={(e) => update(l.key, { discount: e.target.value })} /></div>
              <div className="sm:col-span-1">
                <label className="text-xs text-muted">GST</label>
                <select className={inputClass} value={l.taxRateBp} onChange={(e) => update(l.key, { taxRateBp: Number(e.target.value) })}>
                  {GST_RATES_BP.map((r) => <option key={r} value={r}>{r / 100}%</option>)}
                </select>
              </div>
              <div className="flex items-end justify-between gap-2 sm:col-span-2 sm:flex-col sm:items-end">
                <span className="text-sm font-medium tabular-nums">{formatINR(t?.total ?? 0)}</span>
                {lines.length > 1 && (
                  <button type="button" className="text-xs text-muted hover:text-gave" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>Remove</button>
                )}
              </div>
            </div>
          );
        })}
        <button type="button" className="text-sm font-medium text-brand" onClick={() => setLines((ls) => [...ls, blank()])}>+ Add line</button>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <Field label="Notes / terms"><textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </Card>
        <Card className="space-y-1 text-sm">
          <Row label="Taxable value" value={totals.taxable} />
          {interState ? <Row label="IGST" value={totals.igst} /> : (<><Row label="CGST" value={totals.cgst} /><Row label="SGST" value={totals.sgst} /></>)}
          <Row label="Round off" value={totals.roundOff} />
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Total</span><span className="tabular-nums">{formatINR(totals.total)}</span></div>
        </Card>
      </div>

      <ErrorText>{state.error}</ErrorText>
      <SubmitButton>{isQuote ? "Create quotation" : "Create invoice"}</SubmitButton>
    </ActionForm>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className="tabular-nums">{formatINR(value)}</span></div>;
}
