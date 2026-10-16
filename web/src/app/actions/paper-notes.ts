"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { saveUpload, sniffType } from "@/lib/files";
import { noteAiOn, noteFreePerMonth, readNoteImage } from "@/lib/note-ai";
import { checkCashSaleRow, checkExpenseRow } from "@/lib/import-more";
import { istDay } from "@/lib/ledger";
import { monthBounds } from "@/lib/finance";

export type NoteState = { error?: string; ok?: string };

const noon = (d: string) => new Date(`${d}T12:00:00+05:30`);
const IMAGES = ["image/png", "image/jpeg", "image/webp"];

/** Reads a photo of a paper note and opens the page where the owner checks the lines before anything is saved. */
export async function readNote(_prev: NoteState, form: FormData): Promise<NoteState> {
  const ctx = await requireBusiness("ledger:write");
  const { business, user } = ctx;
  if (!noteAiOn()) return { error: "Reading photos is not switched on yet. Ask the person who runs FinOps to turn it on." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo" };
  if (file.size > 5_000_000) return { error: "The photo is too big. Try again, or take it closer to the page." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffType(bytes);
  if (!mime || !IMAGES.includes(mime)) return { error: "Please upload a photo (JPG, PNG or WebP)" };

  const hash = createHash("sha256").update(bytes).digest("hex");
  const same = await db.noteScan.findFirst({ where: { businessId: business.id, imageHash: hash, status: { in: ["READ", "SAVED"] } }, orderBy: { createdAt: "desc" } });
  if (same?.status === "READ") redirect(`/paper-notes/${same.id}`);
  if (same?.status === "SAVED") return { error: `This page was already saved on ${istDay(same.savedAt ?? same.createdAt)}.` };

  const month = monthBounds(istDay(new Date()).slice(0, 7));
  const used = await db.noteScan.count({ where: { businessId: business.id, createdAt: { gte: month.gte, lte: month.lte } } });
  if (used >= noteFreePerMonth()) return { error: `You have read ${used} pages this month, which is the limit for now. You can still type the lines in by hand.` };

  const read = await readNoteImage(bytes, mime, istDay(new Date()));
  if (!read.ok) return { error: read.error };

  const saved = await saveUpload(file, { businessId: business.id, userId: user.id, kind: "ATTACHMENT" });
  const scan = await db.$transaction(async (tx) => {
    const s = await tx.noteScan.create({ data: { businessId: business.id, fileId: saved.ok ? saved.id : null, imageHash: hash, rowsJson: JSON.stringify({ rows: read.note.rows, pageDate: read.note.pageDate, problems: read.note.problems }), createdById: user.id } });
    await audit(tx, { businessId: business.id, actorId: user.id, action: "read_note", entity: "NoteScan", entityId: s.id, data: { lines: read.note.rows.length } });
    return s;
  });
  redirect(`/paper-notes/${scan.id}`);
}

type Reviewed = { include?: boolean; date: string; item: string; qty: string; amount: string; type: "IN" | "OUT"; mode: string; category: string };

/** Saves the lines the owner kept: sales become cash sales, money paid out becomes expenses. Each page can be saved only once. */
export async function saveNote(_prev: NoteState, form: FormData): Promise<NoteState> {
  const ctx = await requireBusiness("ledger:write");
  const { business, user } = ctx;
  const scan = await db.noteScan.findFirst({ where: { id: String(form.get("scanId") ?? ""), businessId: business.id } });
  if (!scan) return { error: "This page was not found" };
  if (scan.status !== "READ") return { error: "This page has already been saved" };
  let rows: Reviewed[];
  try {
    rows = JSON.parse(String(form.get("rows") ?? "[]"));
  } catch {
    return { error: "Something went wrong. Please open the page again." };
  }
  if (!Array.isArray(rows) || rows.length > 300) return { error: "Something went wrong. Please open the page again." };
  const kept = rows.filter((r) => r.include);
  if (kept.length === 0) return { error: "Tick at least one line to save" };

  const sales: { date: string; item: string; qtyMilli: number | null; amountPaise: number; mode: string }[] = [];
  const expenses: { date: string; amountPaise: number; category: string; mode: string; note: string | null }[] = [];
  for (const [i, r] of kept.entries()) {
    if (r.type === "OUT") {
      const c = checkExpenseRow((k) => ({ date: r.date, amount: r.amount, category: r.category || "Other", mode: r.mode, note: r.item }[k] ?? ""));
      if (!c.ok) return { error: `Line ${i + 1}: ${c.error}` };
      expenses.push({ date: c.value.date, amountPaise: c.value.amountPaise, category: c.value.category, mode: c.value.mode, note: c.value.note });
    } else {
      const c = checkCashSaleRow((k) => ({ date: r.date, item: r.item, amount: r.amount, qty: r.qty, mode: r.mode }[k] ?? ""));
      if (!c.ok) return { error: `Line ${i + 1}: ${c.error}` };
      sales.push({ date: c.value.date, item: c.value.item, qtyMilli: c.value.qtyMilli, amountPaise: c.value.amountPaise, mode: c.value.mode });
    }
  }

  try {
  await db.$transaction(async (tx) => {
    const claimed = await tx.noteScan.updateMany({ where: { id: scan.id, status: "READ" }, data: { status: "SAVED", rowsSaved: kept.length, savedAt: new Date() } });
    if (claimed.count !== 1) throw new Error("already saved");
    for (const s of sales) {
      await tx.cashSale.create({ data: { businessId: business.id, branchId: ctx.branchId, date: noon(s.date), item: s.item, qtyMilli: s.qtyMilli, amountPaise: BigInt(s.amountPaise), paymentMode: s.mode, source: "NOTE_PHOTO", noteScanId: scan.id, createdById: user.id } });
    }
    for (const e of expenses) {
      await tx.expense.create({ data: { businessId: business.id, branchId: ctx.branchId, date: noon(e.date), amountPaise: BigInt(e.amountPaise), category: e.category, paymentMode: e.mode, note: e.note ? `Paper note: ${e.note}` : "Paper note", createdById: user.id } });
    }
    await audit(tx, { businessId: business.id, actorId: user.id, action: "save_note", entity: "NoteScan", entityId: scan.id, data: { sales: sales.length, expenses: expenses.length } });
  });
  } catch {
    return { error: "This page was already saved, or could not be saved. Open it again to check." };
  }
  for (const p of ["/cashbook", "/expenses", "/money/profit", "/paper-notes"]) revalidatePath(p);
  redirect(`/paper-notes?saved=${kept.length}`);
}

/** Throws a page away without saving anything from it. */
export async function discardNote(form: FormData): Promise<void> {
  const ctx = await requireBusiness("ledger:write");
  const id = String(form.get("scanId") ?? "");
  const r = await db.noteScan.updateMany({ where: { id, businessId: ctx.business.id, status: "READ" }, data: { status: "FAILED", error: "Discarded" } });
  if (r.count === 1) await db.$transaction((tx) => audit(tx, { businessId: ctx.business.id, actorId: ctx.user.id, action: "discard_note", entity: "NoteScan", entityId: id }));
  revalidatePath("/paper-notes");
  redirect("/paper-notes");
}

