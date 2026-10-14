"use client";

import { useActionState } from "react";
import { startPayment } from "@/app/actions/pay";

export function PayButton({ kind, token, label, color }: { kind: "invoice" | "party"; token: string; label: string; color: string }) {
  const [state, action, pending] = useActionState(startPayment, {});
  return (
    <form action={action} className="no-print">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="token" value={token} />
      <button disabled={pending} className="rounded-lg px-4 py-2 font-semibold text-white disabled:opacity-60" style={{ background: color }}>{pending ? "Please wait…" : label}</button>
      {state.error && <p role="alert" className="mt-1 text-base text-gave">{state.error}</p>}
    </form>
  );
}
