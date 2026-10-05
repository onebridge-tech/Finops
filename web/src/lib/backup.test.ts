import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { encryptBackup } from "./backup-crypto";

describe("backup encryption", () => {
  it("is decrypted by the restore script", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "blp-"));
    const file = path.join(dir, "backup-test.zip.enc");
    const data = new TextEncoder().encode("ledger data ₹1,250.50");
    writeFileSync(file, encryptBackup(data, "correct horse"));
    execFileSync(process.execPath, ["scripts/decrypt-backup.mjs", file], { env: { ...process.env, BACKUP_KEY: "correct horse" } });
    expect(readFileSync(path.join(dir, "backup-test.zip"), "utf8")).toBe("ledger data ₹1,250.50");
  });
  it("refuses a wrong key", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "blp-"));
    const file = path.join(dir, "b.zip.enc");
    writeFileSync(file, encryptBackup(new Uint8Array([1, 2, 3]), "right"));
    expect(() => execFileSync(process.execPath, ["scripts/decrypt-backup.mjs", file], { env: { ...process.env, BACKUP_KEY: "wrong" }, stdio: "pipe" })).toThrow();
  });
});
