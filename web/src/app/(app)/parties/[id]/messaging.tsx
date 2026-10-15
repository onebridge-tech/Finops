"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { sendPartyMessage, updatePartyReminders } from "@/app/actions/messaging";
import { ErrorText, Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { RuleFields } from "@/components/rule-fields";

const CHANNEL_LABEL = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email" } as const;
type Ch = keyof typeof CHANNEL_LABEL;

/** Send a reminder or statement. WhatsApp goes to your outbox (free); SMS costs a credit; email is free. */
export function SendMessageForm({ partyId, blocked, canRemind }: { partyId: string; blocked: Record<Ch, string | null>; canRemind: boolean }) {
  const [state, action, pending] = useActionState(sendPartyMessage, {});
  const first = (Object.keys(blocked) as Ch[]).find((c) => !blocked[c]) ?? "WHATSAPP";
  const [channel, setChannel] = useState<Ch>(first);
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3">
      <input type="hidden" name="partyId" value={partyId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Send">
          <Select name="kind" defaultValue={canRemind ? "REMINDER" : "STATEMENT"}>
            {canRemind && <option value="REMINDER">Payment reminder</option>}
            <option value="STATEMENT">Account statement</option>
            <option value="INVITE">Invite to use the app (free)</option>
          </Select>
        </Field>
        <Field label="By" hint={channel === "SMS" ? "1 credit" : channel === "WHATSAPP" ? "Free. Goes to your WhatsApp outbox" : "Free"}>
          <Select name="channel" value={channel} onChange={(e) => setChannel(e.target.value as Ch)}>
            {(Object.keys(CHANNEL_LABEL) as Ch[]).map((c) => (
              <option key={c} value={c} disabled={!!blocked[c]}>
                {CHANNEL_LABEL[c]}{blocked[c] ? ` — ${blocked[c]}` : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <ErrorText>{state.error}</ErrorText>
      {state.info && <p className="text-sm text-got">{state.info}</p>}
      <SubmitButton variant="secondary">Send now</SubmitButton>
    </ActionForm>
  );
}

type Rule = { mode: string; daysBefore: number | null; onDue: boolean; everyDaysAfter: number | null; channel: string };

export function PartyReminderForm({ partyId, rule, businessRule }: { partyId: string; rule: Rule; businessRule: string }) {
  const [state, action, pending] = useActionState(updatePartyReminders, {});
  const [mode, setMode] = useState(rule.mode);
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3">
      <input type="hidden" name="partyId" value={partyId} />
      <Field label="Automatic reminders" hint={mode === "DEFAULT" ? `Business default: ${businessRule}` : undefined}>
        <Select name="mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="DEFAULT">Use business default</option>
          <option value="CUSTOM">Custom schedule for this party</option>
          <option value="OFF">Off for this party</option>
        </Select>
      </Field>
      {mode === "CUSTOM" && <RuleFields rule={rule} />}
      <ErrorText>{state.error}</ErrorText>
      {state.info && <p className="text-sm text-got">{state.info}</p>}
      <SubmitButton variant="secondary">Save</SubmitButton>
    </ActionForm>
  );
}
