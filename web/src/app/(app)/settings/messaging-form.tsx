"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/action-form";
import { runRemindersNow, updateMessagingSettings } from "@/app/actions/messaging";
import { ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { RuleFields } from "@/components/rule-fields";

type Props = {
  values: {
    reminderEnabled: boolean; daysBefore: number | null; onDue: boolean; everyDaysAfter: number | null; channel: string;
    autoReceipt: boolean; entryConfirm: boolean;
  };
};

const check = "size-4 accent-[var(--brand)]";

export function MessagingSettingsForm({ values: v }: Props) {
  const [state, action, pending] = useActionState(updateMessagingSettings, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="reminderEnabled" defaultChecked={v.reminderEnabled} className={check} />
        Send automatic payment reminders
      </label>
      <RuleFields rule={v} />
      <p className="text-xs text-muted">Sent between 9 am and 8 pm, at most once a day per party, only to parties who agreed to messages. Reminders stop by themselves once a party has paid or is marked disputed.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="autoReceipt" defaultChecked={v.autoReceipt} className={check} />
        Send a receipt automatically for every payment received
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="entryConfirm" defaultChecked={v.entryConfirm} className={check} />
        Tick “send this entry to the party” by default on new entries
      </label>
      <ErrorText>{state.error}</ErrorText>
      {state.info && <p className="text-sm text-got">{state.info}</p>}
      <SubmitButton>Save messaging settings</SubmitButton>
    </ActionForm>
  );
}

export function RunRemindersButton() {
  const [state, action, pending] = useActionState(runRemindersNow, {});
  return (
    <ActionForm dispatch={() => action()} pending={pending} className="space-y-2">
      <SubmitButton variant="secondary">Run reminders, digest & tasks now</SubmitButton>
      {state.info && <p className="text-xs text-muted">{state.info}</p>}
    </ActionForm>
  );
}
