"use client";

import { ActionForm } from "@/components/action-form";
import { useActionState, useEffect, useRef } from "react";
import { createItem, updateItem } from "@/app/actions/billing";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { GST_RATES_BP } from "@/lib/gst";

export type ItemValues = {
  id: string; name: string; description: string; sku: string; unit: string; price: string; purchasePrice: string;
  hsn: string; taxRateBp: number; isPublic: boolean; parentId: string; variantName: string; imageUrl: string | null;
  category: string; trackStock: boolean; reorderLevel: string;
};

export function ItemForm({ item, bases }: { item?: ItemValues; bases: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(item ? updateItem : createItem, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && !item) form.current?.reset();
  }, [state, item]);
  const v = item;
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="grid gap-3 sm:grid-cols-6">
      {v && <input type="hidden" name="itemId" value={v.id} />}
      <div className="sm:col-span-2"><Field label="Item name"><Input name="name" required defaultValue={v?.name} /></Field></div>
      <Field label="Selling price (₹, before GST)" hint="What you charge for one unit. GST is added on top when you make the bill."><Input name="price" inputMode="decimal" required defaultValue={v?.price} /></Field>
      <Field label="Buying price (₹)" hint="What you pay for one unit. Not shown to customers. We use it to work out your profit."><Input name="purchasePrice" inputMode="decimal" defaultValue={v?.purchasePrice} /></Field>
      <Field label="GST rate" hint="The tax on this item. If you are not sure, ask your accountant. Most items are 5, 12 or 18%.">
        <Select name="taxRateBp" defaultValue={String(v?.taxRateBp ?? 1800)}>
          {GST_RATES_BP.map((r) => <option key={r} value={r}>{r / 100}%</option>)}
        </Select>
      </Field>
      <Field label="Unit" hint="How you count it: kg, pcs, litre, box, packet."><Input name="unit" defaultValue={v?.unit ?? "pcs"} required /></Field>
      <Field label="HSN/SAC" hint="The government’s code for this kind of goods (HSN) or service (SAC). Only needed on GST bills. Your accountant can tell you."><Input name="hsn" inputMode="numeric" defaultValue={v?.hsn} /></Field>
      <Field label="Item code (optional)" hint="Your own short code or barcode number, to find the item fast."><Input name="sku" defaultValue={v?.sku} /></Field>
      <Field label="Variant of" hint="Use this when the item comes in sizes or colours. Pick the main item here, and give this one its own size or colour below.">
        <Select name="parentId" defaultValue={v?.parentId ?? ""}>
          <option value="">None</option>
          {bases.filter((b) => b.id !== v?.id).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>
      <Field label="Variant name" hint="For example Red, or XL, or 500 g."><Input name="variantName" defaultValue={v?.variantName} /></Field>
      <div className="sm:col-span-2"><Field label="Description"><Input name="description" defaultValue={v?.description} /></Field></div>
      <Field label="Category" hint="Used in sales analysis and the catalogue"><Input name="category" defaultValue={v?.category} placeholder="Grains, Furniture…" /></Field>
      <label className="flex items-start gap-2 self-center text-sm"><input type="checkbox" name="trackStock" defaultChecked={v?.trackStock} className="mt-0.5 size-4 accent-[var(--brand)]" /><span>Track stock<span className="block text-xs text-muted">Tick this to count how many are left. Each bill takes some out, and each purchase adds some.</span></span></label>
      <Field label="Low-stock level" hint="When the stock goes down to this number, the item shows in “low stock” so you can order more in time."><Input name="reorderLevel" inputMode="decimal" defaultValue={v?.reorderLevel} /></Field>
      {!v && <Field label="Opening stock" hint="How many you have right now. Only used if Track stock is ticked."><Input name="openingStock" inputMode="decimal" /></Field>}
      <div className="sm:col-span-3">
        <Field label="Image" hint="PNG, JPG or WebP, up to 2 MB">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {v?.imageUrl && <img src={v.imageUrl} alt="" className="h-12 w-12 rounded border border-line object-cover" />}
            <input type="file" name="image" accept="image/png,image/jpeg,image/webp" className="text-sm" />
          </div>
          {v?.imageUrl && <label className="mt-1 flex items-center gap-1 text-xs text-muted"><input type="checkbox" name="removeImage" /> Remove image</label>}
        </Field>
      </div>
      <label className="flex items-center gap-2 self-center text-sm sm:col-span-3">
        <input type="checkbox" name="isPublic" defaultChecked={v?.isPublic} className="size-4 accent-[var(--brand)]" />
        Show in my shareable catalogue
      </label>
      <div className="space-y-2 sm:col-span-6">
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton>{v ? "Save item" : "Add item"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
