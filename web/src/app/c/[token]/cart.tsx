"use client";

import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { placeCatalogueOrder } from "@/app/actions/catalogue-order";
import { ErrorText, Input, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { formatINR } from "@/lib/money";

type P = { id: string; name: string; description: string; unit: string; price: number; gst: number; category: string; image: string | null };

export function CatalogueCart({ token, products, business }: { token: string; products: P[]; business: string }) {
  const [state, action, pending] = useActionState(placeCatalogueOrder, {});
  const [qty, setQty] = useState<Record<string, string>>({});
  const picks = useMemo(() => products.map((p) => ({ p, q: Number(qty[p.id]) || 0 })).filter((x) => x.q > 0), [products, qty]);
  const total = picks.reduce((s, { p, q }) => s + Math.round(p.price * q * (1 + p.gst / 100)), 0);
  const groups = Map.groupBy(products, (p) => p.category);

  if (state.ok) {
    return (
      <div className="rounded-xl border border-got/40 bg-got/5 p-6 text-center">
        <p className="text-lg font-semibold text-got">Order request sent{state.number && state.number !== "—" ? ` · ${state.number}` : ""}</p>
        <p className="mt-1 text-sm text-muted">{business} will contact you to confirm. Nothing is charged online.</p>
      </div>
    );
  }

  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-8">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="lines" value={JSON.stringify(picks.map(({ p, q }) => ({ itemId: p.id, qty: q })))} />
      {[...groups.entries()].map(([cat, items]) => (
        <section key={cat}>
          <h2 className="mb-2 text-base font-semibold tracking-tight">{cat}</h2>
          <div className="divide-y divide-line rounded-xl border border-line bg-card">
            {items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.image ? <img src={p.image} alt="" className="size-16 shrink-0 rounded-lg border border-line object-cover" /> : <span className="size-16 shrink-0 rounded-lg border border-dashed border-line" />}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{p.name}</span>
                  {p.description && <span className="block text-xs text-muted">{p.description}</span>}
                  <span className="text-sm tabular-nums">{formatINR(p.price)} <span className="text-xs text-muted">per {p.unit} + {p.gst}% GST</span></span>
                </span>
                <span className="no-print">
                  <input inputMode="decimal" aria-label={`Quantity of ${p.name}`} placeholder="Qty" value={qty[p.id] ?? ""} onChange={(e) => setQty((s) => ({ ...s, [p.id]: e.target.value }))} className={`${inputClass} w-20 text-center`} />
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="no-print space-y-3 rounded-xl border border-line bg-card p-4">
        <h2 className="text-base font-semibold tracking-tight">Send an order request</h2>
        {picks.length > 0 ? <p className="text-sm text-muted">{picks.length} item{picks.length === 1 ? "" : "s"} · about {formatINR(total)} including GST</p> : <p className="text-sm text-muted">Enter quantities above.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="name" required placeholder="Your name / shop name" autoComplete="name" />
          <Input name="phone" required inputMode="tel" placeholder="Mobile number" autoComplete="tel" />
        </div>
        <Input name="note" placeholder="Anything we should know? (optional)" />
        {/* Hidden from people; bots fill it in and are ignored. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton>Send order request</SubmitButton>
        <p className="text-xs text-muted">This is a request, not a confirmed order or payment. {business} will get back to you.</p>
      </section>
    </ActionForm>
  );
}
