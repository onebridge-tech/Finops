import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

// File format read by scripts/decrypt-backup.mjs:
//   "BLPBAK1" | salt (16) | iv (12) | GCM tag (16) | AES-256-GCM ciphertext
// The key is derived from BACKUP_KEY with scrypt.
export const BACKUP_MAGIC = "BLPBAK1";

export function encryptBackup(data: Uint8Array, passphrase: string): Uint8Array {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(passphrase, salt, 32), iv);
  const body = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([Buffer.from(BACKUP_MAGIC), salt, iv, cipher.getAuthTag(), body]);
}
