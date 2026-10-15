"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { grantCredits, restoreShop, suspendShop, type AdminState } from "@/app/actions/platform";
import { Card, ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icon";

const textarea = "block min-h-20 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function GiveCredits({ businessId, balance }: { businessId: string; balance: number }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(grantCredits, {});
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-semibold">Give message credits</h3>
        <p className="text-sm text-muted">They have {balance} now. One credit sends one WhatsApp or SMS message.</p>
      </div>
      <ActionForm dispatch={action} pending={pending} className="space-y-3">
        <input type="hidden" name="businessId" value={businessId} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Credits"><Input name="amount" inputMode="numeric" placeholder="e.g. 100" required /></Field>
          <div className="sm:col-span-2"><Field label="Reason (kept in the history)"><Input name="reason" placeholder="e.g. Goodwill after a failed top-up" required /></Field></div>
        </div>
        <ErrorText>{state.error}</ErrorText>
        {state.ok && <p role="status" className="rounded-lg bg-got/10 px-3 py-2 text-sm text-got">{state.ok}</p>}
        <SubmitButton>Add credits</SubmitButton>
      </ActionForm>
    </Card>
  );
}

export function SuspendControls({ businessId, suspended, reason, since }: { businessId: string; suspended: boolean; reason: string | null; since: string | null }) {
  const [sState, sAction, sPending] = useActionState<AdminState, FormData>(suspendShop, {});
  const [rState, rAction, rPending] = useActionState<AdminState, FormData>(restoreShop, {});
  if (suspended) {
    return (
      <Card className="space-y-3 border-warn/40 bg-warn/5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warn/15 text-warn"><Icon name="lock" size={18} /></span>
          <div>
            <h3 className="font-semibold">This shop is paused</h3>
            <p className="text-sm text-muted">Since {since}. Its people see a “paused” page. Nothing is sent for it, and its public links stop taking orders and payments.</p>
            {reason && <p className="mt-2 text-sm">“{reason}”</p>}
          </div>
        </div>
        <ActionForm dispatch={rAction} pending={rPending}>
          <input type="hidden" name="businessId" value={businessId} />
          <ErrorText>{rState.error}</ErrorText>
          {rState.ok && <p role="status" className="mb-2 text-sm text-got">{rState.ok}</p>}
          <SubmitButton>Open the shop again</SubmitButton>
        </ActionForm>
      </Card>
    );
  }
  return (
    <Card className="space-y-3">
      <div>
        <h3 className="font-semibold">Pause this shop</h3>
        <p className="text-sm text-muted">Use this for misuse or at the owner’s request. Nothing is deleted. You can open it again at any time.</p>
      </div>
      <ActionForm dispatch={sAction} pending={sPending} className="space-y-3">
        <input type="hidden" name="businessId" value={businessId} />
        <Field label="Message for the shop owner (they will see this)">
          <textarea name="reason" className={textarea} maxLength={300} required placeholder="e.g. We saw unusual messages sent from this shop. Please write to us so we can help." />
        </Field>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="mt-0.5 size-4 accent-[var(--brand)]" />I understand the people in this shop will be locked out until I open it again.</label>
        <ErrorText>{sState.error}</ErrorText>
        {sState.ok && <p role="status" className="text-sm text-got">{sState.ok}</p>}
        <SubmitButton variant="danger">Pause shop</SubmitButton>
      </ActionForm>
    </Card>
  );
}
