"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { sendBulkReminders } from "@/app/actions/messaging";
import { Card, ErrorText, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { CREDIT_COST } from "@/lib/credits";

type Ch = "WHATSAPP" | "SMS" | "EMAIL";
type Row = { id: string; name: string; amount: string; balance: string; nextDue: string | null; blocked: Record<Ch, string | null> };

export function BulkReminderForm({ rows, credits }: { rows: Row[]; credits: number }) {
  const [state, action, pending] = useActionState(sendBulkReminders, {});
  const [channel, setChannel] = useState<Ch>("WHATSAPP");
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const sendable = rows.filter((r) => !r.blocked[channel]);
  const selected = sendable.filter((r) => picked.has(r.id));
  const cost = selected.length * CREDIT_COST[channel];
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3">
      <Card className="flex flex-wrap items-end justify-between gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Send reminders by</span>
          <Select name="channel" value={channel} onChange={(e) => setChannel(e.target.value as Ch)} className="w-40">
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
          </Select>
        </label>
        <div className="text-right text-sm">
          <p>{selected.length} selected · <span className={cost > credits ? "text-gave" : ""}>{cost} credit{cost === 1 ? "" : "s"}</span> of {credits} available</p>
          {cost > credits && <Link href="/settings/credits" className="text-xs text-brand underline">Buy credits</Link>}
        </div>
        <SubmitButton>Send {selected.length || ""} reminder{selected.length === 1 ? "" : "s"}</SubmitButton>
      </Card>
      <ErrorText>{state.error}</ErrorText>
      {state.info && <p className="text-sm text-got">{state.info}</p>}

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-line bg-bg/50 text-left text-xs font-medium text-muted">
            <tr>
              <th className="w-10 px-4 py-2">
                <input type="checkbox" aria-label="Select all" className="size-4 accent-[var(--brand)]"
                  checked={sendable.length > 0 && selected.length === sendable.length}
                  onChange={(e) => setPicked(e.target.checked ? new Set(sendable.map((r) => r.id)) : new Set())} />
              </th>
              <th className="px-2 py-2 font-medium">Party</th>
              <th className="px-4 py-2 text-right font-medium">Amount</th>
              <th className="px-4 py-2 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const why = r.blocked[channel];
              return (
                <tr key={r.id} className={why ? "text-muted" : ""}>
                  <td className="px-4 py-2">
                    {!why && <input type="checkbox" name="partyId" value={r.id} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[var(--brand)]" aria-label={`Select ${r.name}`} />}
                  </td>
                  <td className="px-2 py-2">
                    <Link href={`/parties/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                    <span className="block text-xs text-muted">{why ?? (r.nextDue ? `Next due ${r.nextDue}` : "")}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gave">{r.amount}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.balance}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </ActionForm>
  );
}
