"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { sendBulkReminders } from "@/app/actions/messaging";
import { Avatar, Card, ErrorText, Select } from "@/components/ui";
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
        <SubmitButton>{channel === "WHATSAPP" ? "Add" : "Send"} {selected.length || ""} reminder{selected.length === 1 ? "" : "s"}{channel === "WHATSAPP" ? " to my outbox" : ""}</SubmitButton>
      </Card>
      <ErrorText>{state.error}</ErrorText>
      {state.info && <p className="text-sm text-got">{state.info}</p>}

      <Card className="divide-y divide-line p-0 sm:p-0">
        <label className="flex items-center gap-3 bg-bg/50 px-4 py-2.5 text-xs font-medium text-muted">
          <input type="checkbox" aria-label="Select all" className="size-4 accent-[var(--brand)]"
            checked={sendable.length > 0 && selected.length === sendable.length}
            onChange={(e) => setPicked(e.target.checked ? new Set(sendable.map((r) => r.id)) : new Set())} />
          Select everyone who can be messaged
        </label>
        {rows.map((r) => {
          const why = r.blocked[channel];
          return (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${why ? "opacity-70" : ""}`}>
              <span className="w-4 shrink-0">
                {!why && <input type="checkbox" name="partyId" value={r.id} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-[var(--brand)]" aria-label={`Select ${r.name}`} />}
              </span>
              <Avatar name={r.name} size={34} />
              <span className="min-w-0 flex-1">
                <Link href={`/parties/${r.id}`} className="block truncate font-medium hover:underline">{r.name}</Link>
                <span className="block truncate text-xs text-muted">{why ?? (r.nextDue ? `Next due ${r.nextDue}` : "")}</span>
              </span>
              <span className="text-right">
                <span className="block font-semibold tabular-nums text-gave">{r.amount}</span>
                <span className="block text-xs tabular-nums text-muted">of {r.balance}</span>
              </span>
            </div>
          );
        })}
      </Card>
    </ActionForm>
  );
}
