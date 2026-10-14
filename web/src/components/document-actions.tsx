"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "./action-form";
import { cancelInvoice, sendDocument } from "@/app/actions/billing";
import { ErrorText, Input, Select } from "./ui";
import { SubmitButton } from "./submit-button";

type Ch = "WHATSAPP" | "SMS" | "EMAIL";

/** Send an invoice or quotation through WhatsApp API, SMS or email (BD-05). */
export function SendDocumentForm({ kind, id, blocked }: { kind: "INVOICE" | "QUOTE"; id: string; blocked: Record<Ch, string | null> }) {
  const [state, action, pending] = useActionState(sendDocument, {});
  const options: [Ch, string][] = [["WHATSAPP", "WhatsApp"], ["SMS", "SMS"], ["EMAIL", "Email"]];
  return (
    <ActionForm dispatch={action} pending={pending} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <Select name="channel" defaultValue={options.find(([c]) => !blocked[c])?.[0]} className="w-auto">
        {options.map(([c, label]) => <option key={c} value={c} disabled={!!blocked[c]}>{label}{blocked[c] ? ` — ${blocked[c]}` : ""}</option>)}
      </Select>
      <SubmitButton variant="secondary">Send</SubmitButton>
      {state.info && <span className="text-sm text-got">{state.info}</span>}
      {state.error && <span className="text-sm text-gave">{state.error}</span>}
    </ActionForm>
  );
}

export function CancelInvoiceForm({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(cancelInvoice, {});
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="text-sm text-muted underline hover:text-gave">Cancel this bill</button>;
  }
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-2 rounded-lg border border-gave/40 p-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <p className="text-sm">Cancelling takes this bill off the customer’s account. Do this only before you file GST for the month. After that, make a return note instead.</p>
      <Input name="reason" placeholder="Reason, e.g. wrong customer" required />
      <ErrorText>{state.error}</ErrorText>
      <div className="flex gap-2">
        <SubmitButton variant="danger">Cancel this bill</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted">Keep it</button>
      </div>
    </ActionForm>
  );
}
