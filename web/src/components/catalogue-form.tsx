"use client";

import { useActionState } from "react";
import { ActionForm } from "./action-form";
import { setCatalogue } from "@/app/actions/catalog";
import { SubmitButton } from "./submit-button";
import { ErrorText } from "./ui";

export function CatalogueForm({ enabled, url, count }: { enabled: boolean; url: string | null; count: number }) {
  const [state, action, pending] = useActionState(setCatalogue, {});
  return (
    <ActionForm dispatch={action} pending={pending} className="space-y-3 text-sm">
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="size-4 accent-[var(--brand)]" />
        Share a catalogue where buyers can send order requests
      </label>
      <p className="text-xs text-muted">{count} item{count === 1 ? "" : "s"} marked “Show in my shareable catalogue” (Items → Edit). Requests arrive in Orders → Requests and the buyer is saved as a lead.</p>
      {enabled && url && <p className="break-all rounded bg-bg px-2 py-1 font-mono text-xs"><a href={url} target="_blank" className="underline">{url}</a></p>}
      <ErrorText>{state.error}</ErrorText>
      <div className="flex items-center gap-3"><SubmitButton variant="secondary">Save</SubmitButton>{state.info && <span className="text-sm text-got">{state.info}</span>}</div>
    </ActionForm>
  );
}
