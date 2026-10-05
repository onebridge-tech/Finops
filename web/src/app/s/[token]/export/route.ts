import { db } from "@/lib/db";
import { statement } from "@/lib/statement";
import { writeTable, type TableFormat } from "@/lib/spreadsheet";
import { istDay } from "@/lib/ledger";
import { toRupeeString } from "@/lib/money";

// Statement download as Excel or CSV (LG-05). Public by unguessable token, like the statement page.
export async function GET(request: Request, ctx: RouteContext<"/s/[token]/export">) {
  const { token } = await ctx.params;
  const url = new URL(request.url);
  const party = await db.party.findUnique({ where: { shareToken: token }, include: { business: { select: { name: true } } } });
  if (!party || party.archivedAt) return new Response("Not found", { status: 404 });
  const format: TableFormat = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const st = await statement(party.id, url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);

  const rows: (string | number | null)[][] = [];
  if (st.from) rows.push([st.from, "Balance brought forward", null, null, toRupeeString(st.opening)]);
  for (const e of st.rows) {
    rows.push([
      istDay(e.date), e.note ?? (e.direction === "GAVE" ? "Credit" : "Payment received"),
      e.direction === "GAVE" ? toRupeeString(Number(e.amountPaise)) : null,
      e.direction === "GOT" ? toRupeeString(Number(e.amountPaise)) : null,
      toRupeeString(e.running),
    ]);
  }
  rows.push(["", "Closing balance", toRupeeString(st.totalGave), toRupeeString(st.totalGot), toRupeeString(st.closing)]);

  const out = await writeTable(format, "Statement", ["Date", "Details", "Debit (₹)", "Credit (₹)", "Balance (₹)"], rows);
  const name = `${party.business.name} - ${party.name} statement`.replace(/[^\w\- ]+/g, "").trim();
  return new Response(out.body, {
    headers: { "Content-Type": out.type, "Content-Disposition": `attachment; filename="${name}.${out.ext}"` },
  });
}
