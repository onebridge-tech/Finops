"use client";

import { useActionState, useState } from "react";
import { saveTemplate, resetTemplate, type TemplateState } from "@/app/actions/templates";
import { Badge, Card, ErrorText, buttonClass } from "@/components/ui";

type Props = { kind: string; label: string; about: string; lang: string; initial: string; builtIn: string; isCustom: boolean; sample: Record<string, string> };

const fill = (t: string, v: Record<string, string>) => t.replace(/\{([a-zA-Z]+)\}/g, (all, k: string) => v[k] ?? all);

/** One message's wording with a live preview of what a customer will read. */
export function TemplateEditor({ kind, label, about, lang, initial, builtIn, isCustom, sample }: Props) {
  const [body, setBody] = useState(initial);
  const [saved, saveAction, saving] = useActionState<TemplateState, FormData>(saveTemplate, {});
  const [, resetAction, resetting] = useActionState<TemplateState, FormData>(async (p, f) => { const r = await resetTemplate(p, f); setBody(builtIn); return r; }, {});
  const changed = body.trim() !== initial.trim();
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{label}</h2>
          <p className="text-sm text-muted">{about}</p>
        </div>
        {isCustom ? <Badge tone="brand">Your wording</Badge> : <Badge>Built-in wording</Badge>}
      </div>
      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="lang" value={lang} />
        <label className="block">
          <span className="sr-only">Wording for {label}</span>
          <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={900} className="block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        </label>
        <div className="rounded-xl bg-[#e7fbe2] p-3 text-sm text-[#0b3d1b] dark:bg-[#12331c] dark:text-[#d6f5dd]">
          <p className="mb-1 text-xs font-medium opacity-70">What the customer reads</p>
          <p className="whitespace-pre-line break-words">{fill(body, sample)}</p>
        </div>
        <ErrorText>{saved.error}</ErrorText>
        {saved.ok && !changed && <p role="status" className="text-sm text-got">Saved.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button className={buttonClass("primary")} disabled={saving || !changed}>{saving ? "Saving…" : "Save wording"}</button>
          {(isCustom || body.trim() !== builtIn.trim()) && (
            <button type="submit" formAction={resetAction} disabled={resetting} className={buttonClass("secondary")}>Use the built-in wording</button>
          )}
        </div>
      </form>
    </Card>
  );
}
