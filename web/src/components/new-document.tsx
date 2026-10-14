import { partyWhere, type Ctx } from "@/lib/auth";
import { db } from "@/lib/db";
import { sellerFor } from "@/lib/doc-core";
import { EmptyState, LinkButton, PageHeader, todayIST } from "./ui";
import { DocumentForm, type DocKind } from "./document-form";
import type { PriceRow } from "@/lib/rules";

const TITLE: Record<DocKind, string> = {
  INVOICE: "Make a bill", QUOTE: "New price quote", SALES_ORDER: "New customer order", PURCHASE_ORDER: "New order to supplier", DEBIT_NOTE: "New extra charge note",
};

/** Every "new document" page shares this loader and form. */
export async function NewDocument({ kind, ctx, preselect }: { kind: DocKind; ctx: Ctx; preselect: string }) {
  const { business } = ctx;
  const purchase = kind === "PURCHASE_ORDER";
  const types = purchase ? ["SUPPLIER", "BOTH"] : kind === "DEBIT_NOTE" ? ["CUSTOMER", "SUPPLIER", "BOTH"] : ["CUSTOMER", "BOTH", "LEAD"];
  const [parties, items, seller] = await Promise.all([
    db.party.findMany({ where: { AND: [partyWhere(ctx), { archivedAt: null, type: { in: types } }] }, orderBy: { name: "asc" } }),
    db.item.findMany({ where: { businessId: business.id, archivedAt: null }, orderBy: [{ name: "asc" }, { variantName: "asc" }] }),
    sellerFor(db, business.id, ctx.branchId),
  ]);
  if (parties.length === 0) {
    return (
      <EmptyState title={purchase ? "Add a supplier first" : "Add a customer first"}>
        <LinkButton href="/parties/new" className="mt-3">Add customer</LinkButton>
      </EmptyState>
    );
  }

  // Rates on the price lists of the parties in this list (sales documents only).
  const listIds = [...new Set(parties.map((p) => p.priceListId).filter((x): x is string => !!x))];
  const rows = purchase || listIds.length === 0 ? [] : await db.priceListItem.findMany({ where: { priceListId: { in: listIds }, priceList: { archivedAt: null } } });
  const byList = Map.groupBy(rows, (r) => r.priceListId);
  const priceRows: Record<string, PriceRow[]> = {};
  for (const p of parties) {
    if (p.priceListId) priceRows[p.id] = (byList.get(p.priceListId) ?? []).map((r) => ({ itemId: r.itemId, minQtyMilli: r.minQtyMilli, ratePaise: Number(r.ratePaise) }));
  }

  const next = { INVOICE: `${business.invoicePrefix}${business.nextInvoiceNo}`, QUOTE: `${business.quotePrefix}${business.nextQuoteNo}`, SALES_ORDER: `${business.orderPrefix}${business.nextOrderNo}`, PURCHASE_ORDER: `${business.poPrefix}${business.nextPoNo}`, DEBIT_NOTE: `${business.debitNotePrefix}${business.nextDebitNoteNo}` }[kind];
  return (
    <>
      <PageHeader title={TITLE[kind]} sub={`Next number: ${kind === "INVOICE" && ctx.branchId && seller.branch ? `${seller.branch.invoicePrefix}${seller.branch.nextInvoiceNo}` : next}`} />
      <DocumentForm
        kind={kind}
        businessState={kind === "PURCHASE_ORDER" ? business.stateCode : seller.stateCode}
        today={todayIST()}
        preselect={preselect}
        priceRows={priceRows}
        parties={parties.map((p) => ({ id: p.id, name: p.name, stateCode: p.stateCode ?? business.stateCode, creditDays: p.creditDays }))}
        items={items.map((i) => ({
          id: i.id, name: i.variantName ? `${i.name} — ${i.variantName}` : i.name, hsn: i.hsn ?? "", unit: i.unit,
          ratePaise: Number(purchase ? (i.purchasePricePaise ?? i.pricePaise) : i.pricePaise), taxRateBp: i.taxRateBp,
        }))}
      />
    </>
  );
}
