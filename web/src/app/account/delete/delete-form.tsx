"use client";

import { startTransition, useActionState, useState } from "react";
import { requestAccountDeletion, type DeleteState } from "@/app/actions/account";
import { Card, ErrorText, Field, Input, buttonClass } from "@/components/ui";

export function DeleteForm({ hasPassword, closing, days }: { hasPassword: boolean; closing: number; days: number }) {
  const [s, action, pending] = useActionState<DeleteState, FormData>(requestAccountDeletion, {});
  const [understood, setUnderstood] = useState(false);
  return (
    <Card className="space-y-3 border-gave/30">
      <h2 className="font-semibold">Delete my account</h2>
      {/* Sent by hand rather than with form={action}: React clears a form after each try, and a wrong password shouldn't untick the box. */}
      <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); startTransition(() => action(f)); }} className="space-y-3">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="understand" className="mt-0.5" required checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>
            I understand my account{closing ? ` and ${closing === 1 ? "my shop" : `my ${closing} shops`}` : ""} will close now and be erased for good after {days} days,
            and that I should download anything I need first.
          </span>
        </label>
        {hasPassword ? (
          <Field label="Your password" hint="To make sure it’s really you.">
            <Input type="password" name="password" autoComplete="current-password" required />
          </Field>
        ) : (
          <Field label="Type DELETE to confirm">
            <Input name="confirm" autoComplete="off" required />
          </Field>
        )}
        <ErrorText>{s.error}</ErrorText>
        <button className={buttonClass("danger")} disabled={pending}>{pending ? "Closing your account…" : "Delete my account"}</button>
      </form>
    </Card>
  );
}
