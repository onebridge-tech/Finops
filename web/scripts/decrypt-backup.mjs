// Decrypts a backup written with BACKUP_KEY set.
//   BACKUP_KEY=... node scripts/decrypt-backup.mjs backups/backup-<stamp>.zip.enc
// Writes backup-<stamp>.zip next to it. Unzip it, then copy database.sqlite to the
// path in DATABASE_URL and uploads/ to UPLOAD_DIR, with the app stopped.
import { createDecipheriv, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const MAGIC = "BLPBAK1";
const [file] = process.argv.slice(2);
const key = process.env.BACKUP_KEY;
if (!file || !key) {
  console.error("Usage: BACKUP_KEY=... node scripts/decrypt-backup.mjs <file.zip.enc>");
  process.exit(1);
}
const buf = readFileSync(file);
if (buf.subarray(0, MAGIC.length).toString() !== MAGIC) {
  console.error("Not an encrypted backup file");
  process.exit(1);
}
let o = MAGIC.length;
const salt = buf.subarray(o, (o += 16));
const iv = buf.subarray(o, (o += 12));
const tag = buf.subarray(o, (o += 16));
const decipher = createDecipheriv("aes-256-gcm", scryptSync(key, salt, 32), iv);
decipher.setAuthTag(tag);
const out = Buffer.concat([decipher.update(buf.subarray(o)), decipher.final()]);
const target = file.replace(/\.enc$/, "");
writeFileSync(target, out);
console.log(`Decrypted to ${target}`);
