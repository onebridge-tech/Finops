import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/files";
import { istDay } from "@/lib/ledger";
import { EXPENSE_CATEGORIES } from "@/lib/expense-categories";
import { Card, PageHeader } from "@/components/ui";
import { NoteReview } from "./review";

export const metadata = { title: "Check the page" };

export default async function ReviewNote({ params }: PageProps<"/paper-notes/[id]">) {
  const { id } = await params;
  const ctx = await requireBusiness("ledger:write");
  const scan = await db.noteScan.findFirst({ where: { id, businessId: ctx.business.id } });
  if (!scan) notFound();
  const data = scan.rowsJson ? (JSON.parse(scan.rowsJson) as { rows: { date: string; item: string; qty: number | null; amountPaise: number; type: "IN" | "OUT"; confidence: number }[]; problems: string[] }) : { rows: [], problems: [] };
  const photo = fileUrl(scan.fileId);
  const open = scan.status === "READ";

  return (
    <>
      <PageHeader title="Check the page" sub={`Read on ${istDay(scan.createdAt)} · ${open ? "nothing is saved until you press Save" : scan.status === "SAVED" ? `${scan.rowsSaved} lines saved` : "discarded"}`} action={<Link href="/paper-notes" className="text-sm text-brand underline">All pages</Link>} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div>
          {photo ? (
            <a href={photo} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="The photo of the page" className="w-full rounded-xl border border-line object-contain" />
            </a>
          ) : <Card className="text-sm text-muted">The photo is not available.</Card>}
          {data.problems.length > 0 && (
            <Card className="mt-3 border-warn/30 bg-warn/5 text-sm">
              <p className="font-medium">Please look at these</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">{data.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </Card>
          )}
        </div>
        <div>
          {open ? (
            <NoteReview scanId={scan.id} initial={data.rows} categories={EXPENSE_CATEGORIES} today={istDay(new Date())} />
          ) : (
            <Card className="text-sm text-muted">{scan.status === "SAVED" ? "These lines are in your cash book and expenses." : "This page was discarded and nothing from it was saved."}</Card>
          )}
        </div>
      </div>
    </>
  );
}
