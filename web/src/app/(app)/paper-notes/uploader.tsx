"use client";

import { useActionState, useRef, useState } from "react";
import { readNote, type NoteState } from "@/app/actions/paper-notes";
import { ErrorText } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icon";

/** Makes a phone photo small enough to send (about 1,800 pixels on the long side) before it leaves the phone. */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "note.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function NoteUploader({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<NoteState, FormData>(readNote, {});
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit(form: FormData) {
    const f = form.get("photo");
    if (f instanceof File && f.size > 0) form.set("photo", await shrink(f));
    action(form);
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await submit(new FormData(e.currentTarget));
        setBusy(false);
      }}
      className="space-y-3"
    >
      <label className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-card p-6 text-center transition hover:border-brand/50 ${disabled ? "pointer-events-none opacity-60" : ""}`}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="The note you chose" className="max-h-64 rounded-lg object-contain" />
        ) : (
          <>
            <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand"><Icon name="note" size={24} /></span>
            <span className="font-medium">Take a photo of the page, or choose one</span>
            <span className="text-xs text-muted">Put the page flat, with good light, so the writing is clear.</span>
          </>
        )}
        <input
          ref={input}
          type="file"
          name="photo"
          accept="image/*"
          capture="environment"
          required
          disabled={disabled}
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; setPreview(f ? URL.createObjectURL(f) : null); }}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{pending || busy ? "Reading the page…" : "Read this page"}</SubmitButton>
        {preview && <button type="button" className="text-sm text-muted underline" onClick={() => { setPreview(null); if (input.current) input.current.value = ""; }}>Choose a different photo</button>}
        <ErrorText>{state.error}</ErrorText>
      </div>
      {(pending || busy) && <p role="status" className="text-sm text-muted">Reading can take up to a minute. Please keep this page open.</p>}
    </form>
  );
}
