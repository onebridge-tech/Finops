import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

// File storage. Phase 1 stores bytes on local disk (UPLOAD_DIR, default ./uploads);
// put that directory on a persistent volume and include it in backups. Swap
// putObject/getObject for an object store (S3, R2) when scaling out.

const ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

async function putObject(key: string, bytes: Uint8Array) {
  const file = path.join(ROOT, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}

export async function getObject(key: string): Promise<Buffer> {
  const file = path.resolve(ROOT, key);
  if (!file.startsWith(path.resolve(ROOT))) throw new Error("Bad key");
  return readFile(file);
}

export type FileKind = "LOGO" | "SIGNATURE" | "ITEM_IMAGE" | "ATTACHMENT";

const IMAGE = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED: Record<FileKind, { types: string[]; maxBytes: number }> = {
  LOGO: { types: IMAGE, maxBytes: 1_000_000 },
  SIGNATURE: { types: IMAGE, maxBytes: 500_000 },
  ITEM_IMAGE: { types: IMAGE, maxBytes: 2_000_000 },
  ATTACHMENT: { types: [...IMAGE, "application/pdf", "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4"], maxBytes: 5_000_000 },
};

/** Real type from the file's first bytes; the browser-supplied type is not trusted. */
export function sniffType(b: Uint8Array): string | null {
  const starts = (sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
  if (starts([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (starts([0x25, 0x50, 0x44, 0x46])) return "application/pdf";
  if (starts([0x1a, 0x45, 0xdf, 0xa3])) return "audio/webm";
  if (starts([0x4f, 0x67, 0x67, 0x53])) return "audio/ogg";
  if (starts([0x49, 0x44, 0x33]) || starts([0xff, 0xfb]) || starts([0xff, 0xf3])) return "audio/mpeg";
  if (starts([0x66, 0x74, 0x79, 0x70], 4)) return "audio/mp4";
  return null;
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/** Size and real-type check, without storing anything. Returns an error message or null. */
export async function checkUpload(file: File, kind: FileKind): Promise<string | null> {
  const rule = ALLOWED[kind];
  if (file.size === 0) return "The file is empty";
  if (file.size > rule.maxBytes) return `File is too large (max ${Math.round((rule.maxBytes / 1_000_000) * 10) / 10} MB)`;
  const mime = sniffType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  return mime && rule.types.includes(mime) ? null : "This file type is not allowed";
}

export async function saveUpload(file: File, o: { businessId: string; userId: string; kind: FileKind; entryId?: string }): Promise<SaveResult> {
  const error = await checkUpload(file, o.kind);
  if (error) return { ok: false, error };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffType(bytes)!;

  const storageKey = `${o.businessId}/${randomBytes(16).toString("hex")}`;
  await putObject(storageKey, bytes);
  const rec = await db.storedFile.create({
    data: {
      businessId: o.businessId, kind: o.kind, name: file.name.slice(0, 120) || "file", mime, size: file.size,
      storageKey, entryId: o.entryId ?? null, createdById: o.userId,
    },
  });
  return { ok: true, id: rec.id };
}

function signature(id: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`file:${id}`).digest("base64url").slice(0, 32);
}

/** Unguessable link to a stored file, safe to put on public pages. */
export function fileUrl(id: string | null | undefined): string | null {
  return id ? `/files/${id}/${signature(id)}` : null;
}

export function verifyFileSignature(id: string, sig: string): boolean {
  const a = Buffer.from(signature(id));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}
