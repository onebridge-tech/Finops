import "server-only";
import type { Ctx } from "./auth";
import { resolvePeriod, type Period } from "./period";
import {
  ageingReport, daybook, expenseAnalysis, salesAnalysis, sourceReport, topReport,
  type ReportResult, type SalesBy, type TopDim,
} from "./reports";
import { ordersReport, stockReport } from "./reports2";
import { todayIST } from "./format";

export const REPORT_KINDS = ["ageing", "daybook", "top", "sales", "expenses", "sources", "orders", "stock"] as const;
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
  }
  return { result, period };
}
