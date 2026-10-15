import { Field, Input, Select } from "./ui";

const CHANNEL_LABEL = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email" } as const;

type Rule = { daysBefore: number | null; onDue: boolean; everyDaysAfter: number | null; channel: string };

/** Shared by the party override and the business default in Settings. */
export function RuleFields({ rule }: { rule: Rule }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Days before due date" hint="A friendly early reminder. Type 2 to remind 2 days before the money is due. Leave empty for none.">
        <Input name="daysBefore" inputMode="numeric" defaultValue={rule.daysBefore ?? ""} />
      </Field>
      <Field label="Then every N days while overdue" hint="After the due date passes, remind again every this many days until they pay. Type 3 for every 3 days. Leave empty to remind once.">
        <Input name="everyDaysAfter" inputMode="numeric" defaultValue={rule.everyDaysAfter ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="onDue" defaultChecked={rule.onDue} className="size-4 accent-[var(--brand)]" />
        <span>On the due date<span className="block text-xs text-muted">Send a reminder on the day the money is due.</span></span>
      </label>
      <Field label="Send by" hint="WhatsApp messages wait in your outbox for you to tap Send. SMS and email go out by themselves and SMS uses credits.">
        <Select name="channel" defaultValue={rule.channel}>
          {(Object.keys(CHANNEL_LABEL) as (keyof typeof CHANNEL_LABEL)[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
        </Select>
      </Field>
    </div>
  );
}
