"use client";

import { useActionState, useRef } from "react";
import { ActionForm } from "@/components/action-form";
import { addAttachment } from "@/app/actions/data";

/** Small "attach" link on an entry row: pick a file and it uploads straight away. */
export function AttachToEntry({ entryId }: { entryId: string }) {
  const [state, action, pending] = useActionState(addAttachment, {});
  const form = useRef<HTMLFormElement>(null);
  return (
    <ActionForm ref={form} dispatch={action} pending={pending} className="inline">
      <input type="hidden" name="entryId" value={entryId} />
      <label className="cursor-pointer text-sm text-muted underline hover:text-ink" title="Attach a bill photo, PDF or voice note">
        {pending ? "Uploading…" : "Attach"}
        <input type="file" name="files" accept="image/png,image/jpeg,image/webp,application/pdf,audio/*" className="sr-only"
          onChange={() => form.current?.requestSubmit()} />
      </label>
      {state.error && <span className="block text-sm text-gave">{state.error}</span>}
    </ActionForm>
  );
}
