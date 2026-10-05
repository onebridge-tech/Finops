"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { partyWhere, requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { newShareToken } from "@/lib/session";
import { MAX_IMPORT_ROWS, readTable } from "@/lib/spreadsheet";
import { checkUpload, saveUpload } from "@/lib/files";
import { checkItemRow, checkPartyRow, FIELDS, guessMapping, type ImportKind } from "@/lib/import-rows";
import { runBackup } from "@/lib/backup";

export type PreviewState = { error?: string; header?: string[]; rows?: string[][]; mapping?: Record<string, number> };
export type CommitState = { error?: string; imported?: number; skipped?: { row: number; name: string; reason: string }[] };

/** Step 1 of the import wizard: read the file and guess which column is which. */
export async function previewImport(_prev: PreviewState, form: FormData): Promise<PreviewState> {
  await requireBusiness(form.get("kind") === "items" ? "item:write" : "party:write");
  const kind = form.get("kind") === "items" ? "items" : "parties";
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
  if (file.size > 5_000_000) return { error: "File is too large (max 5 MB)" };
  let table: string[][];
  try {
    table = await readTable(file);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not read the file" };
  }
  if (table.length < 2) return { error: "The file needs a header row and at least one data row" };
  if (table.length - 1 > MAX_IMPORT_ROWS) return { error: `At most ${MAX_IMPORT_ROWS} rows at a time; split the file` };
  const [header, ...rows] = table;
  return { header, rows, mapping: guessMapping(kind, header) };
}

/**
 * Step 2: validate every row with the chosen column mapping and import the
 * valid ones. Rows that fail or already exist are reported back, not imported.
 */
export async function commitImport(_prev: CommitState, form: FormData): Promise<CommitState> {
  const kind: ImportKind = form.get("kind") === "items" ? "items" : "parties";
  const ctx = await requireBusiness(kind === "items" ? "item:write" : "party:write");
  const { user, business } = ctx;
  let rows: string[][];
  let mapping: Record<string, number>;
  try {
    rows = JSON.parse(String(form.get("rows")));
    mapping = JSON.parse(String(form.get("mapping")));
  } catch {
    return { error: "Invalid import data" };
  }
  if (!Array.isArray(rows) || rows.length > MAX_IMPORT_ROWS) return { error: "Invalid import data" };
  for (const f of FIELDS[kind]) if (f.required && mapping[f.key] === undefined) return { error: `Choose the column for “${f.label}”` };

  const cell = (r: string[], key: string) => (mapping[key] === undefined ? "" : String(r[mapping[key]] ?? ""));
  const skipped: NonNullable<CommitState["skipped"]> = [];
  let imported = 0;
  const today = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}T12:00:00+05:30`);

  if (kind === "parties") {
    const existing = await db.party.findMany({ where: { businessId: business.id, archivedAt: null }, select: { name: true, phone: true } });
    const names = new Set(existing.map((p) => p.name.toLowerCase()));
    const phones = new Set(existing.map((p) => p.phone).filter(Boolean));
    for (const [i, r] of rows.entries()) {
      const c = checkPartyRow((k) => cell(r, k));
      const label = cell(r, "name") || `(row ${i + 2})`;
      if (!c.ok) { skipped.push({ row: i + 2, name: label, reason: c.error }); continue; }
      const p = c.value;
      if (names.has(p.name.toLowerCase()) || (p.phone && phones.has(p.phone))) { skipped.push({ row: i + 2, name: label, reason: "Already exists" }); continue; }
      await db.$transaction(async (tx) => {
        const party = await tx.party.create({
          data: {
            businessId: business.id, name: p.name, type: p.type, phone: p.phone, email: p.email, gstin: p.gstin,
            stateCode: p.stateCode, address: p.address, creditDays: p.creditDays, source: "Import", shareToken: newShareToken(),
            branchId: ctx.branchId, ownerId: ctx.assignedOnly ? user.id : null,
          },
        });
        if (p.openingPaise > 0) {
          await tx.ledgerEntry.create({
            data: {
              businessId: business.id, partyId: party.id, branchId: ctx.branchId, direction: p.openingDirection, amountPaise: BigInt(p.openingPaise),
              date: today, note: "Opening balance", source: "OPENING", createdById: user.id,
            },
          });
        }
      });
      names.add(p.name.toLowerCase());
      if (p.phone) phones.add(p.phone);
      imported++;
    }
  } else {
    const existing = await db.item.findMany({ where: { businessId: business.id, archivedAt: null }, select: { name: true } });
    const names = new Set(existing.map((x) => x.name.toLowerCase()));
    for (const [i, r] of rows.entries()) {
      const c = checkItemRow((k) => cell(r, k));
      const label = cell(r, "name") || `(row ${i + 2})`;
      if (!c.ok) { skipped.push({ row: i + 2, name: label, reason: c.error }); continue; }
      const it = c.value;
      if (names.has(it.name.toLowerCase())) { skipped.push({ row: i + 2, name: label, reason: "Already exists" }); continue; }
      await db.item.create({
        data: {
          businessId: business.id, name: it.name, pricePaise: BigInt(it.pricePaise),
          purchasePricePaise: it.purchasePricePaise === null ? null : BigInt(it.purchasePricePaise),
          taxRateBp: it.taxRateBp, hsn: it.hsn, unit: it.unit, sku: it.sku,
        },
      });
      names.add(it.name.toLowerCase());
      imported++;
    }
  }
  await db.$transaction((tx) => audit(tx, { businessId: business.id, actorId: user.id, action: "import", entity: kind === "items" ? "Item" : "Party", entityId: business.id, data: { imported, skipped: skipped.length } }));
  revalidatePath(kind === "items" ? "/items" : "/parties");
  return { imported, skipped };
}

/**
 * Runs a backup now. Backups cover the whole installation (every business), so
 * only an owner can trigger one; the file stays on the server.
 */
export async function backupNow(): Promise<{ error?: string; info?: string }> {
  const ctx = await requireBusiness("settings:write");
  const { user, business, role } = ctx;
  if (role !== "OWNER") return { error: "Only the owner can run a backup" };
  const r = await runBackup();
  await db.$transaction((tx) => audit(tx, { businessId: business.id, actorId: user.id, action: "backup", entity: "Business", entityId: business.id }));
  revalidatePath("/data");
  return { info: `Backup written (${Math.round(r.bytes / 1024)} KB${r.encrypted ? ", encrypted" : ", not encrypted: set BACKUP_KEY"})` };
}

/** Adds a bill photo, PDF or voice note to an existing entry (LG-03). Entries stay immutable. */
export async function addAttachment(_prev: { error?: string; ok?: boolean }, form: FormData): Promise<{ error?: string; ok?: boolean }> {
  const ctx = await requireBusiness("ledger:write");
  const { user, business } = ctx;
  const entry = await db.ledgerEntry.findFirst({ where: { id: String(form.get("entryId")), businessId: business.id, party: partyWhere(ctx) } });
  if (!entry) return { error: "Entry not found" };
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose a file" };
  const count = await db.storedFile.count({ where: { entryId: entry.id } });
  if (count + files.length > 5) return { error: "At most 5 attachments per entry" };
  for (const f of files) {
    const err = await checkUpload(f, "ATTACHMENT");
    if (err) return { error: `${f.name}: ${err}` };
  }
  for (const f of files) await saveUpload(f, { businessId: business.id, userId: user.id, kind: "ATTACHMENT", entryId: entry.id });
  await db.$transaction((tx) => audit(tx, { businessId: business.id, actorId: user.id, action: "attach", entity: "LedgerEntry", entityId: entry.id, data: { files: files.map((f) => f.name) } }));
  revalidatePath(`/parties/${entry.partyId}`);
  return { ok: true };
}
