import Link from "next/link";
import type { ReportResult, Row } from "@/lib/reports";
import { formatINR } from "@/lib/money";
import { Card } from "./ui";

function cell(col: ReportResult["columns"][number], v: Row[string]) {
  if (v === null || v === undefined || v === "") return <span className="text-muted">—</span>;
  if (col.money && typeof v === "number") return formatINR(v);
  if (col.pct && typeof v === "number") {
    const sign = col.key === "change" && v > 0 ? "+" : "";
    return <span className={col.key === "change" ? (v > 0 ? "text-got" : v < 0 ? "text-gave" : "") : ""}>{sign}{v}%</span>;
  }
  return String(v);
}

/** A report as a table: money right-aligned, rows with an href become links, optional totals row. */
export function ReportTable({ result }: { result: ReportResult }) {
  const { columns, rows, totals } = result;
  if (rows.length === 0) return <Card className="text-sm text-muted">Nothing to show for these filters.</Card>;
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line text-left text-xs uppercase text-muted">
          <tr>{columns.map((c) => <th key={c.key} className={`px-3 py-2 font-medium ${c.right ? "text-right" : ""}`}>{c.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-bg">
              {columns.map((c, j) => (
                <td key={c.key} className={`px-3 py-2 ${c.right ? "text-right tabular-nums" : ""}`}>
                  {j === 0 && r.href ? <Link href={r.href} className="font-medium underline-offset-2 hover:underline">{cell(c, r[c.key])}</Link> : cell(c, r[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {totals && (
          <tfoot className="border-t border-line font-semibold">
            <tr>{columns.map((c) => <td key={c.key} className={`px-3 py-2 ${c.right ? "text-right tabular-nums" : ""}`}>{totals[c.key] === undefined ? "" : cell(c, totals[c.key])}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </Card>
  );
}
