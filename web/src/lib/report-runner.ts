import "server-only";
import type { Ctx } from "./auth";
import { resolvePeriod, type Period } from "./period";
import {
  ageingReport, daybook, expenseAnalysis, salesAnalysis, sourceReport, topReport,
  type ReportResult, type SalesBy, type TopDim,
} from "./reports";
import { ordersReport, stockReport } from "./reports2";
import { todayIST } from "./format";
import { attendanceRows, missedVisits } from "./field-team";

export const REPORT_KINDS = ["ageing", "daybook", "top", "sales", "expenses", "sources", "orders", "stock", "attendance", "missed"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_TITLES: Record<ReportKind, { name: string; about: string; needsPeriod: boolean }> = {
  ageing: { name: "Outstanding ageing", about: "Who owes you, by how many days late", needsPeriod: false },
  daybook: { name: "Daybook", about: "Every entry and document in a period", needsPeriod: true },
  top: { name: "Top customers, items, suppliers, reps", about: "Ranked by value or margin", needsPeriod: true },
  sales: { name: "Sales analysis", about: "By month, item, category, location, rep, branch", needsPeriod: true },
  expenses: { name: "Expense analysis", about: "By category, branch, month", needsPeriod: true },
  sources: { name: "Lead sources & reps", about: "Where customers come from and what they bring", needsPeriod: true },
  orders: { name: "Pending orders", about: "What is ordered but not yet delivered", needsPeriod: false },
  stock: { name: "Stock", about: "Levels, low stock and value", needsPeriod: false },
  attendance: { name: "Attendance", about: "Days each rep started work; export for payroll", needsPeriod: true },
  missed: { name: "Missed visits", about: "Planned beat stops with no visit", needsPeriod: true },
};

type Sp = Record<string, string | string[] | undefined>;
const s = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <T extends string>(v: string, allowed: readonly T[], fallback: T): T => (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Runs a report from URL parameters. The same call feeds the page and its downloads. */
export async function runReport(ctx: Ctx, kind: ReportKind, sp: Sp): Promise<{ result: ReportResult; period: Period }> {
  const period = resolvePeriod({ period: s(sp.period), from: s(sp.from), to: s(sp.to) }, todayIST());
  let result: ReportResult;
  switch (kind) {
    case "ageing":
      result = await ageingReport(ctx, pick(s(sp.by), ["party", "rep", "branch"], "party"), { rep: s(sp.rep) || undefined, branch: s(sp.branch) || undefined });
      break;
    case "daybook":
      result = await daybook(ctx, period, { type: s(sp.type) || undefined, user: s(sp.user) || undefined, branch: s(sp.branch) || undefined });
      break;
    case "top":
      result = await topReport(ctx, period, pick(s(sp.dim), ["customers", "items", "suppliers", "reps"] as const, "customers") as TopDim, pick(s(sp.metric), ["value", "margin"], "value"), pick(s(sp.n), ["5", "10", "50"], "10") === "5" ? 5 : s(sp.n) === "50" ? 50 : 10);
      break;
    case "sales":
      result = await salesAnalysis(ctx, period, pick(s(sp.by), ["month", "item", "category", "location", "rep", "branch", "customer"] as const, "month") as SalesBy);
      break;
    case "expenses":
      result = await expenseAnalysis(ctx, period, pick(s(sp.by), ["category", "branch", "month", "entries"], "category"), s(sp.cat) || undefined);
      break;
    case "sources":
      result = await sourceReport(ctx, period, pick(s(sp.by), ["source", "rep"], "source"));
      break;
    case "orders":
      result = await ordersReport(ctx, pick(s(sp.kind), ["SALES", "PURCHASE"], "SALES"));
      break;
    case "stock":
      result = await stockReport(ctx, s(sp.low) === "1");
      break;
    case "attendance": {
      const rows = await attendanceRows(ctx, period.from, period.to);
      const time = (d: Date) => d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
      if (pick(s(sp.by), ["days", "log"], "days") === "log") {
        result = {
          title: "Attendance log", note: "First check-in of each day, from Start my day or the first visit.",
          columns: [{ key: "date", label: "Date" }, { key: "rep", label: "Rep" }, { key: "time", label: "Started" }, { key: "source", label: "How" }, { key: "selfie", label: "Selfie" }],
          rows: rows.map((r) => ({ date: r.date, rep: r.rep, time: time(r.at), source: r.source === "DAYSTART" ? "Start my day" : "First visit", selfie: r.hasPhoto ? "Yes" : "" })),
        };
      } else {
        const by = new Map<string, number>();
        for (const r of rows) by.set(r.rep, (by.get(r.rep) ?? 0) + 1);
        result = {
          title: "Days present", note: "Number of days each rep started work in the period. Use for payroll.",
          columns: [{ key: "rep", label: "Rep" }, { key: "days", label: "Days present", right: true }],
          rows: [...by].sort((a, b) => b[1] - a[1]).map(([rep, days]) => ({ rep, days })),
        };
      }
      break;
    }
    case "missed": {
      const rows = await missedVisits(ctx, period.from, period.to);
      result = {
        title: "Missed visits", note: "Customers on a rep’s beat for that weekday who were not visited.",
        columns: [{ key: "date", label: "Date" }, { key: "rep", label: "Rep" }, { key: "beat", label: "Beat" }, { key: "party", label: "Customer" }],
        rows, totals: { date: `${rows.length} missed` },
      };
      break;
    }
  }
  return { result, period };
}
