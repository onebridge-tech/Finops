import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { fyLabel, loadYearEnd } from "@/lib/year-end";
import { fyStartYear } from "@/lib/period";
import { todayIST } from "@/lib/format";
import { writeWorkbook } from "@/lib/spreadsheet";

// /reports/year-end/export?fy=2026: the whole financial year (April 2026 to March 2027) as one Excel file for the accountant.
export async function GET(request: Request) {
  const ctx = await requireBusiness("reports:view");
  const { user, business } = ctx;
  const asked = Number(new URL(request.url).searchParams.get("fy"));
  const current = fyStartYear(todayIST());
  const fy = Number.isInteger(asked) && asked >= 2017 && asked <= current ? asked : current;
  const { sheets } = await loadYearEnd(ctx, fy);
  await db.$transaction((tx) => audit(tx, { businessId: business.id, actorId: user.id, action: "export_year_end", entity: "Business", entityId: business.id, data: { fy } }));
  const name = business.name.replace(/[^\w\- ]+/g, "").trim() || "shop";
  return new Response(await writeWorkbook(sheets), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name} year-end pack ${fyLabel(fy)}.xlsx"` },
  });
}
