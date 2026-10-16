import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { istDay } from "@/lib/ledger";
import { monthBounds } from "@/lib/finance";
import { noteAiOn, noteFreePerMonth } from "@/lib/note-ai";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { NoteUploader } from "./uploader";

export const metadata = { title: "Paper notes" };

export default async function PaperNotes({ searchParams }: PageProps<"/paper-notes">) {
  const sp = await searchParams;
  const ctx = await requireBusiness("ledger:write");
  const month = monthBounds(istDay(new Date()).slice(0, 7));
  const [scans, used] = await Promise.all([
    db.noteScan.findMany({ where: { businessId: ctx.business.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    db.noteScan.count({ where: { businessId: ctx.business.id, createdAt: { gte: month.gte, lte: month.lte } } }),
  ]);
  const on = noteAiOn();
  const left = Math.max(0, noteFreePerMonth() - used);
  const saved = Number(Array.isArray(sp.saved) ? sp.saved[0] : sp.saved) || 0;

  return (
    <>
      <PageHeader title="Paper notes" sub="Take a photo of a page where you wrote items and amounts. We read it, you check it, and it is added to your records." />
      {saved > 0 && <p role="status" className="mb-4 rounded-lg bg-got/10 px-3 py-2.5 text-sm text-got">{saved} line{saved === 1 ? "" : "s"} saved. Sales are in your cash book and profit; money paid out is in your expenses.</p>}
      {!on && <Card className="mb-4 border-warn/30 bg-warn/5 text-sm"><p className="font-medium">Reading photos is not switched on yet.</p><p className="text-muted">The person who runs FinOps needs to add the reading service key. Until then you can type lines in by hand under Cash sales or Expenses.</p></Card>}
      <NoteUploader disabled={!on || left === 0} />
      <div className="mt-3 space-y-1 text-xs text-muted">
        <p>{on ? `${left} page${left === 1 ? "" : "s"} left to read this month.` : ""}</p>
        <p>The photo is sent to an AI reading service for this one reading, and kept in your records so you can look at it again. Names and phone numbers are not needed. Read how your data is handled in the <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
        <p>Lines with no name are saved as cash sales (money in) or expenses (money paid out). You can attach a sale to a customer later.</p>
      </div>

      <SectionTitle>Recent pages</SectionTitle>
      {scans.length === 0 ? <Card className="text-sm text-muted">No pages read yet.</Card> : (
        <Card className="divide-y divide-line p-0 text-sm">
          {scans.map((s) => (
            <Link key={s.id} href={`/paper-notes/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg">
              <span>{istDay(s.createdAt)}<span className="block text-xs text-muted">{s.status === "SAVED" ? `${s.rowsSaved} lines saved` : s.status === "READ" ? "Waiting for you to check it" : "Not saved"}</span></span>
              <Badge tone={s.status === "SAVED" ? "good" : s.status === "READ" ? "warn" : "neutral"}>{s.status === "SAVED" ? "Saved" : s.status === "READ" ? "Check it" : "Discarded"}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
