"use client";

import { useActionState } from "react";
import { setTarget } from "@/app/actions/field";
import { Card, Input, Select, buttonClass } from "@/components/ui";
import { METRIC_LABEL } from "@/lib/metric-labels";

export function TargetForm({ month, members }: { month: string; members: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(setTarget, undefined);
  return (
    <Card>
      <form action={action} className="grid gap-2 sm:grid-cols-5">
        <Select name="userId" aria-label="Team member">{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
        <Select name="metric" aria-label="Measure">{Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <Input name="month" type="month" defaultValue={month} aria-label="Month" />
        <Input name="value" inputMode="decimal" placeholder="Target (₹ for money)" aria-label="Target" />
        <button className={buttonClass("primary")} disabled={pending}>Set target</button>
      </form>
      {state?.error && <p role="alert" className="mt-2 text-base text-gave">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 text-base text-got">Target saved.</p>}
    </Card>
  );
}
