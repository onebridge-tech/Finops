import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Keeps secret settings (API keys) unreadable in the database. AES-256-GCM, with the key made from a secret that lives only on the server.
// Format: "enc1:" + base64( salt(16) | iv(12) | tag(16) | ciphertext ).
const PREFIX = "enc1:";

export const isEncrypted = (v: string) => v.startsWith(PREFIX);

export function sealSecret(plain: string, passphrase: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", scryptSync(passphrase, salt, 32), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([salt, iv, c.getAuthTag(), body]).toString("base64");
}

/** The original text, or null if it was made with a different secret or has been changed. */
export function openSecret(sealed: string, passphrase: string): string | null {
  if (!isEncrypted(sealed)) return null;
  try {
    const raw = Buffer.from(sealed.slice(PREFIX.length), "base64");
    const d = createDecipheriv("aes-256-gcm", scryptSync(passphrase, raw.subarray(0, 16), 32), raw.subarray(16, 28));
    d.setAuthTag(raw.subarray(28, 44));
    return Buffer.concat([d.update(raw.subarray(44)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "••••1234": enough to recognise a saved key without showing it. */
export const maskSecret = (v: string) => (v.length <= 6 ? "••••" : `••••${v.slice(-4)}`);
