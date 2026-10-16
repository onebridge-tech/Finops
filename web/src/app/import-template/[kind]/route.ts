import { requireBusiness } from "@/lib/auth";
import { MORE_KINDS, type MoreKind } from "@/lib/import-more";
import { writeTable } from "@/lib/spreadsheet";

const BASE: Record<string, { label: string; example: string[][] }> = {
  parties: { label: "Customers and suppliers", example: [["Name", "Mobile", "GSTIN", "State", "Type", "Credit days", "Opening balance", "Dr/Cr"], ["Lakshmi General Stores", "9848012345", "", "Telangana", "customer", "30", "12000", "Dr"], ["Sri Sai Wholesale", "9000011111", "36AAACB1234C1ZG", "Telangana", "supplier", "", "8000", "Cr"]] },
  items: { label: "Items", example: [["Item name", "Sale price", "Purchase price", "GST %", "HSN", "Unit", "SKU"], ["Tea Powder", "420", "360", "5", "0902", "kg", "TP-1"]] },
};

// /import-template/<kind>: an Excel file with the right column names and a sample row, to fill in and bring back.
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  await requireBusiness();
  const { kind } = await ctx.params;
  const t = BASE[kind] ?? (kind in MORE_KINDS ? { label: MORE_KINDS[kind as MoreKind].label, example: MORE_KINDS[kind as MoreKind].example } : null);
  if (!t) return new Response("Not found", { status: 404 });
  const [header, ...rows] = t.example;
  const out = await writeTable("xlsx", t.label, header, rows);
  return new Response(out.body, { headers: { "Content-Type": out.type, "Content-Disposition": `attachment; filename="FinOps template - ${t.label}.xlsx"` } });
}
