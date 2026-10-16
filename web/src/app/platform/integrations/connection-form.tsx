"use client";

import { useActionState } from "react";
import { saveConnectionSettings, testConnection, type AdminState } from "@/app/actions/platform";
import { ActionForm } from "@/components/action-form";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type F = { env: string; label: string; hint?: string; kind: "text" | "secret" | "select"; options?: [string, string][]; placeholder?: string; source: "admin" | "server" | "none"; shown: string };

const SOURCE = { admin: "Set here", server: "From the server’s settings", none: "" } as const;

export function ConnectionForm({ integration }: { integration: { id: string; testable: boolean; fields: F[] } }) {
  const [save, saveAction, saving] = useActionState<AdminState, FormData>(saveConnectionSettings, {});
  const [test, testAction, testing] = useActionState<AdminState, FormData>(testConnection, {});
  return (
    <div className="space-y-3">
      <ActionForm dispatch={saveAction} pending={saving} className="space-y-4">
        <input type="hidden" name="id" value={integration.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          {integration.fields.map((f) => (
            <div key={f.env} className={f.hint && f.hint.length > 90 ? "sm:col-span-2" : ""}>
              <Field label={f.label} hint={<>{f.hint}{f.source !== "none" && <span className="mt-0.5 block text-[11px] font-medium text-brand">{SOURCE[f.source]}{f.kind === "secret" && f.shown ? ` · ${f.shown}` : ""}</span>}</>}>
                {f.kind === "select" ? (
                  <Select name={f.env} defaultValue={f.shown}>{f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                ) : f.kind === "secret" ? (
                  <Input name={f.env} type="password" autoComplete="off" placeholder={f.shown ? "Saved. Type a new key to replace it" : "Paste the key"} />
                ) : (
                  <Input name={f.env} defaultValue={f.source === "admin" ? f.shown : f.shown} placeholder={f.placeholder} autoComplete="off" />
                )}
              </Field>
              {f.source === "admin" && (
                <label className="mt-1 flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" name={`clear_${f.env}`} className="size-3.5 accent-[var(--brand)]" />Remove what is set here</label>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>Save</SubmitButton>
          <ErrorText>{save.error}</ErrorText>
          {save.ok && <p role="status" className="text-sm font-medium text-got">{save.ok}</p>}
        </div>
      </ActionForm>
      {integration.testable && (
        <ActionForm dispatch={testAction} pending={testing} className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <input type="hidden" name="id" value={integration.id} />
          <SubmitButton variant="secondary">{testing ? "Trying…" : "Test the connection"}</SubmitButton>
          <span className="text-xs text-muted">Sends one short question, with no photo and no customer data. Save first.</span>
          <ErrorText>{test.error}</ErrorText>
          {test.ok && <p role="status" className="text-sm font-medium text-got">{test.ok}</p>}
        </ActionForm>
      )}
    </div>
  );
}
