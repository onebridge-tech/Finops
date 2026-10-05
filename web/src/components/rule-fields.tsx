import { Field, Input, Select } from "./ui";

const CHANNEL_LABEL = { WHATSAPP: "WhatsApp", SMS: "SMS", EMAIL: "Email" } as const;

type Rule = { daysBefore: number | null; onDue: boolean; everyDaysAfter: number | null; channel: string };

/** Shared by the party override and the business default in Settings. */
export function RuleFields({ rule }: { rule: Rule }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Days before due date" hint="Leave empty to skip">
        <Input name="daysBefore" inputMode="numeric" defaultValue={rule.daysBefore ?? ""} />
      </Field>
      <Field label="Then every N days while overdue" hint="Leave empty to skip">
        <Input name="everyDaysAfter" inputMode="numeric" defaultValue={rule.everyDaysAfter ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="onDue" defaultChecked={rule.onDue} className="size-4 accent-[var(--brand)]" />
        On the due date
      </label>
      <Field label="Send by">
        <Select name="channel" defaultValue={rule.channel}>
          {(Object.keys(CHANNEL_LABEL) as (keyof typeof CHANNEL_LABEL)[]).map((c) => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
        </Select>
      </Field>
    </div>
  );
}
