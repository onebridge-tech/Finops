"use client";

import { useActionState } from "react";
import { saveSiteInfo, type AdminState } from "@/app/actions/platform";
import { Card, ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ActionForm } from "@/components/action-form";
import { SITE_FIELDS } from "@/lib/site-fields";

const groups = [...new Set(SITE_FIELDS.map((f) => f.group))];

export function SiteInfoForm({ values }: { values: Record<string, string> }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(saveSiteInfo, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-6">
      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">{g}</h2>
          <Card className="grid gap-5 sm:grid-cols-2">
            {SITE_FIELDS.filter((f) => f.group === g).map((f) => (
              <div key={f.key} className={f.kind === "textarea" ? "sm:col-span-2" : ""}>
                <Field label={f.label} hint={<>{f.hint} <span className="text-muted/80">Shown on: {f.shownOn}.</span></>}>
                  {f.kind === "textarea" ? (
                    <textarea name={f.key} rows={2} defaultValue={values[f.key]} placeholder={f.placeholder} className="block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm shadow-sm outline-none transition placeholder:text-muted/60 focus:border-brand focus:ring-2 focus:ring-brand/20" />
                  ) : (
                    <Input name={f.key} type={f.kind === "email" ? "email" : "text"} inputMode={f.kind === "number" ? "numeric" : undefined} defaultValue={values[f.key]} placeholder={f.placeholder} />
                  )}
                </Field>
              </div>
            ))}
          </Card>
        </section>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save company info</SubmitButton>
        <ErrorText>{state.error}</ErrorText>
        {state.ok && <p className="text-sm font-medium text-got">{state.ok}</p>}
      </div>
    </ActionForm>
  );
}
