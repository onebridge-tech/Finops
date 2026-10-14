import type { StoredFile } from "@prisma/client";
import { fileUrl } from "@/lib/files";

/** Links (and a player for voice notes) for an entry's attachments. Server component. */
export function Attachments({ files }: { files: Pick<StoredFile, "id" | "name" | "mime">[] }) {
  if (files.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-2 text-sm no-underline">
      {files.map((f) => {
        const url = fileUrl(f.id)!;
        return f.mime.startsWith("audio/") ? (
          <audio key={f.id} controls preload="none" src={url} className="h-8 max-w-56" />
        ) : (
          <a key={f.id} href={url} target="_blank" rel="noopener" className="text-brand underline">
            📎 {f.mime === "application/pdf" ? "PDF" : "Photo"}: {f.name}
          </a>
        );
      })}
    </span>
  );
}
