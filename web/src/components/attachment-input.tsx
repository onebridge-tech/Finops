"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./i18n-provider";

/**
 * File picker for bill photos and PDFs plus an in-browser voice-note recorder.
 * Everything ends up in one <input type="file" name="files" multiple>, so the
 * surrounding form submits it like any other upload.
 */
export function AttachmentInput() {
  const input = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  // Mirror the chosen files into the real input so the form submits them.
  const sync = (next: File[]) => {
    const dt = new DataTransfer();
    for (const f of next) dt.items.add(f);
    if (input.current) input.current.files = dt.files;
    setFiles(next);
  };

  // Clear the list when the surrounding form is reset after a successful save.
  useEffect(() => {
    const form = input.current?.form;
    const clear = () => setFiles([]);
    form?.addEventListener("reset", clear);
    return () => form?.removeEventListener("reset", clear);
  }, []);

  const toggleRecording = async () => {
    setError(null);
    if (recording) { recorder.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType.split(";")[0] || "audio/webm";
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        // Read the input, not state: this callback runs long after it was created.
        sync([...(input.current?.files ?? []), new File(chunks, `voice-note-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}.${ext}`, { type })]);
        setRecording(false);
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone not available");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 hover:bg-bg">
        {t("entry.attach")}
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf,audio/*"
          className="sr-only"
          onChange={(e) => { sync([...(input.current?.files ?? []), ...(e.currentTarget.files ?? [])]); e.currentTarget.value = ""; }}
        />
      </label>
      <input ref={input} type="file" name="files" multiple hidden />
      <button type="button" onClick={toggleRecording} className={`rounded-lg border px-3 py-1.5 ${recording ? "border-gave text-gave" : "border-line hover:bg-bg"}`}>
        {recording ? `■ ${t("entry.stop")}` : `🎙 ${t("entry.voice")}`}
      </button>
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded bg-bg px-2 py-0.5 text-xs">
          {f.name}
          <button type="button" aria-label={`Remove ${f.name}`} onClick={() => sync(files.filter((_, j) => j !== i))} className="text-muted hover:text-gave">×</button>
        </span>
      ))}
      {error && <span className="text-xs text-gave">{error}</span>}
    </div>
  );
}
