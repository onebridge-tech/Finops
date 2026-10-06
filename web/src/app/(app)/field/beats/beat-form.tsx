"use client";

import { useActionState, useState } from "react";
import { saveBeat } from "@/app/actions/field";
import { Input, Select, buttonClass } from "@/components/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Beat = { id: string; name: string; userId: string; weekdays: string; partyIds: string[] };

export function BeatForm({ people, parties, beat }: { people: { id: string; name: string }[]; parties: { id: string; name: string }[]; beat?: Beat }) {
  const [state, action, pending] = useActionState(saveBeat, undefined);
  const [ids, setIds] = useState<string[]>(beat?.partyIds ?? []);
  const [pick, setPick] = useState("");
  const name = (id: string) => parties.find((p) => p.id === id)?.name ?? "—";
  const move = (i: number, d: number) => setIds((s) => { const n = [...s]; const j = i + d; if (j < 0 || j >= n.length) return s; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const days = new Set((beat?.weekdays ?? "1,2,3,4,5,6").split(","));
  return (
    <form action={action} className="space-y-3 text-sm">
      {beat && <input type="hidden" name="id" value={beat.id} />}
      <input type="hidden" name="partyIds" value={ids.join(",")} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input name="name" placeholder="Beat name, e.g. Market Road" defaultValue={beat?.name} aria-label="Beat name" />
        <Select name="userId" defaultValue={beat?.userId} aria-label="Rep">{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      </div>
      <fieldset className="flex flex-wrap gap-3"><legend className="sr-only">Weekdays</legend>
        {DAYS.map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name="weekdays" value={i} defaultChecked={days.has(String(i))} />{d}</label>)}
      </fieldset>
      <ol className="space-y-1">
        {ids.map((id, i) => (
          <li key={id} className="flex items-center justify-between rounded-lg border border-line px-3 py-1">
            <span>{i + 1}. {name(id)}</span>
            <span className="flex gap-1">
              <button type="button" aria-label="Move up" className={buttonClass("secondary")} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label="Move down" className={buttonClass("secondary")} onClick={() => move(i, 1)}>↓</button>
              <button type="button" aria-label={`Remove ${name(id)}`} className={buttonClass("secondary")} onClick={() => setIds((s) => s.filter((x) => x !== id))}>✕</button>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Add a customer">
          <option value="">Add a customer…</option>
          {parties.filter((p) => !ids.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <button type="button" className={buttonClass("secondary")} disabled={!pick} onClick={() => { setIds((s) => [...s, pick]); setPick(""); }}>Add</button>
      </div>
      {state?.error && <p role="alert" className="text-gave">{state.error}</p>}
      {state?.ok && <p role="status" className="text-got">Beat saved.</p>}
      <button className={buttonClass("primary")} disabled={pending}>{beat ? "Save beat" : "Create beat"}</button>
    </form>
  );
}
