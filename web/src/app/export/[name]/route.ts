import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { EXPORTS, exportTable, fullExport, type ExportName } from "@/lib/exports";
import { writeTable, type TableFormat } from "@/lib/spreadsheet";

// Downloads for signed-in users: /export/parties?format=xlsx|csv|json, or /export/all for a full ZIP.
export async function GET(request: Request, ctx: RouteContext<"/export/[name]">) {
  const { name } = await ctx.params;
  const { user, business } = await requireBusiness(name === "all" ? "settings:write" : "reports:view");
  const stamp = new Date().toISOString().slice(0, 10);
  const base = business.name.replace(/[^\w\- ]+/g, "").trim() || "export";

  if (name === "all") {
    const zip = await fullExport(business.id);
    await db.$transaction((tx) => audit(tx, { businessId: business.id, actorId: user.id, action: "export_all", entity: "Business", entityId: business.id }));
    return new Response(new Uint8Array(zip), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base} full export ${stamp}.zip"` },
    });
  }
  if (!EXPORTS.includes(name as ExportName)) return new Response("Not found", { status: 404 });
  const f = new URL(request.url).searchParams.get("format");
  const format: TableFormat = f === "csv" || f === "json" ? f : "xlsx";
  const t = await exportTable(business.id, name as ExportName);
  const out = await writeTable(format, t.sheet, t.header, t.rows);
  return new Response(out.body, {
    headers: { "Content-Type": out.type, "Content-Disposition": `attachment; filename="${base} ${name} ${stamp}.${out.ext}"` },
  });
}
