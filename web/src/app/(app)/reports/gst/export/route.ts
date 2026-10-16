import { requireBusiness } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { loadGst } from "@/lib/gst-data";
import { isMonth, monthLabel } from "@/lib/finance";
import { gstr1Json, returnPeriod } from "@/lib/gst-returns";
import { toRupeeString } from "@/lib/money";
import { writeWorkbook, type Sheet } from "@/lib/spreadsheet";

const rs = (p: number) => Number(toRupeeString(p));

// /reports/gst/export?m=2026-10&format=xlsx|gstr1: the month's GST figures as Excel, or as the file the GST portal's offline tool reads.
export async function GET(request: Request) {
  const ctx = await requireBusiness("reports:view");
  const { user, business } = ctx;
  const url = new URL(request.url);
  const m = url.searchParams.get("m") ?? "";
  if (!isMonth(m)) return new Response("Choose a month", { status: 400 });
  const { gstr1: g1, gstr3b: g3, purchases } = await loadGst(ctx, m);
  const base = `${business.name.replace(/[^\w\- ]+/g, "").trim() || "shop"} GST ${m}`;
  await db.$transaction((tx) => audit(tx, { businessId: business.id, actorId: user.id, action: "export_gst", entity: "Business", entityId: business.id, data: { month: m, format: url.searchParams.get("format") } }));

  if (url.searchParams.get("format") === "gstr1") {
    if (!business.gstin) return new Response("Add your shop's GSTIN in Settings first", { status: 400 });
    return new Response(JSON.stringify(gstr1Json(business.gstin, returnPeriod(m), g1), null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="GSTR1-${returnPeriod(m)}.json"` },
    });
  }

  const note = `${business.name} · GST ${monthLabel(m)} · prepared from entries in FinOps; please verify before filing`;
  const sheets: Sheet[] = [
    {
      name: "GSTR-3B summary", note, header: ["Section", "Description", "Taxable value", "IGST", "CGST", "SGST"],
      rows: [
        ["3.1(a)", "Outward taxable supplies", rs(g3.outward.taxable), rs(g3.outward.igst), rs(g3.outward.cgst), rs(g3.outward.sgst)],
        ["3.1(c)", "Nil-rated supplies", rs(g3.nilRated.taxable), null, null, null],
        ["", "Less: credit notes", rs(g3.creditNotes.taxable), rs(g3.creditNotes.igst), rs(g3.creditNotes.cgst), rs(g3.creditNotes.sgst)],
        ["4(A)(5)", "Input tax credit", null, rs(g3.itc.igst), rs(g3.itc.cgst), rs(g3.itc.sgst)],
        ["4(D)", "Credit not claimable", null, rs(g3.itcBlocked.igst), rs(g3.itcBlocked.cgst), rs(g3.itcBlocked.sgst)],
        ["6.1", "Tax payable", null, rs(g3.payable.igst), rs(g3.payable.cgst), rs(g3.payable.sgst)],
      ],
    },
    {
      name: "B2B", note, header: ["Customer GSTIN", "Customer", "Invoice", "Date", "Place of supply", "Rate %", "Taxable value", "IGST", "CGST", "SGST", "Invoice total"],
      rows: g1.b2b.flatMap((c) => c.invoices.flatMap(({ doc, rates }) => rates.map((r, i) => [c.gstin, doc.partyName, doc.number, doc.date, doc.placeOfSupply, r.rateBp / 100, rs(r.taxable), rs(r.igst), rs(r.cgst), rs(r.sgst), i === 0 ? rs(doc.totalPaise) : null]))),
    },
    { name: "B2C small", note, header: ["Place of supply", "Supply", "Rate %", "Taxable value", "IGST", "CGST", "SGST"], rows: g1.b2cs.map((x) => [x.placeOfSupply, x.interState ? "Inter-state" : "Intra-state", x.rateBp / 100, rs(x.taxable), rs(x.igst), rs(x.cgst), rs(x.sgst)]) },
    { name: "B2C large", note, header: ["Invoice", "Customer", "Date", "Place of supply", "Total"], rows: g1.b2cl.map(({ doc }) => [doc.number, doc.partyName, doc.date, doc.placeOfSupply, rs(doc.totalPaise)]) },
    { name: "Credit notes", note, header: ["Note", "Customer", "Customer GSTIN", "Date", "Rate %", "Taxable value", "IGST", "CGST", "SGST"], rows: g1.credit.flatMap(({ doc, rates }) => rates.map((r) => [doc.number, doc.partyName, doc.partyGstin, doc.date, r.rateBp / 100, rs(r.taxable), rs(r.igst), rs(r.cgst), rs(r.sgst)])) },
    { name: "HSN summary", note, header: ["HSN / SAC", "Description", "Unit", "Quantity", "Rate %", "Taxable value", "IGST", "CGST", "SGST", "Total"], rows: g1.hsn.map((h) => [h.hsn, h.description, h.unit, h.qtyMilli / 1000, h.rateBp / 100, rs(h.taxable), rs(h.igst), rs(h.cgst), rs(h.sgst), rs(h.total)]) },
    { name: "Documents issued", note, header: ["Document", "From", "To", "Total", "Cancelled"], rows: g1.docs.map((d) => [d.type, d.from, d.to, d.total, d.cancelled]) },
    { name: "Supplier bills", note, header: ["Supplier", "GSTIN", "Bill number", "Date", "Type", "Taxable value", "IGST", "CGST", "SGST", "Total", "Credit claimable"], rows: purchases.map((b) => [b.supplierName, b.supplierGstin, b.number, b.date.toISOString().slice(0, 10), b.kind, rs(Number(b.taxablePaise)), rs(Number(b.igstPaise)), rs(Number(b.cgstPaise)), rs(Number(b.sgstPaise)), rs(Number(b.totalPaise)), b.itcEligible ? "yes" : "no"]) },
  ];
  return new Response(await writeWorkbook(sheets), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` },
  });
}
