"use client";

import { buttonClass } from "./ui";

/**
 * Credit-control warning (CP-07). The "Continue anyway" button submits the
 * surrounding form again with override=1, which the server accepts for warnings.
 */
export function CreditWarning({ reasons, pending }: { reasons?: string[]; pending?: boolean }) {
  if (!reasons?.length) return null;
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-gave/40 bg-gave/10 p-3 text-base">
      <p className="font-medium text-gave">Credit limit check</p>
      <ul className="list-disc pl-5">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      <button name="override" value="1" disabled={pending} className={buttonClass("secondary")}>Continue anyway</button>
    </div>
  );
}
