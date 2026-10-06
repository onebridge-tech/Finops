import { requireBusiness } from "@/lib/auth";
import { REPORT_KINDS, runReport, type ReportKind } from "@/lib/report-runner";
import { writeTable } from "@/lib/spreadsheet";
import { toRupeeString } from "@/lib/money";

// Excel / CSV download of any report, with the same filters as the page (IR-09).
export async function GET(request: Request, rc: RouteContext<"/reports/[kind]/export">) {
  const { kind } = await rc.params;
  if (!REPORT_KINDS.includes(kind as ReportKind)) return new Response("Not found", { status: 404 });
  const ctx = await requireBusiness("reports:view");
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const { result } = await runReport(ctx, kind as ReportKind, sp);
  const fmt = (c: (typeof result.columns)[number], v: unknown) => (v === null || v === undefined ? null : c.money && typeof v === "number" ? toRupeeString(v) : (v as string | number));
  const rows = result.rows.map((r) => result.columns.map((c) => fmt(c, r[c.key])));
  if (result.totals) rows.push(result.columns.map((c) => fmt(c, result.totals![c.key])));
  const header = result.columns.map((c) => (c.money ? `${c.label} (₹)` : c.label));
  const f = url.searchParams.get("format");
  const out = await writeTable(f === "csv" || f === "json" ? f : "xlsx", result.title, header, rows);
  const base = `${ctx.business.name} ${result.title}`.replace(/[^\w\- ]+/g, "").trim();
  return new Response(out.body, { headers: { "Content-Type": out.type, "Content-Disposition": `attachment; filename="${base} ${new Date().toISOString().slice(0, 10)}.${out.ext}"` } });
}
