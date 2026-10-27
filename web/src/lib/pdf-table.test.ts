import { describe, expect, it } from "vitest";
import { tableFromPdfItems, type PdfItem } from "./pdf-table";
import { buildTxns, checkBalances, findHeaderRow, guessMapping } from "./bank-import";

// A tiny page builder: words at (x, y), as pdf.js reports them (y counted up from the bottom).
const at = (page: number, y: number, ...cells: [number, string][]): PdfItem[] => cells.map(([x, str]) => ({ str, x, y, w: str.length * 4, page }));

const COLS = { date: 30, desc: 90, out: 330, in: 400, bal: 470 };
const header = (page: number, y: number) => at(page, y, [COLS.date, "Date"], [COLS.desc, "Narration"], [COLS.out, "Withdrawal"], [COLS.in, "Deposit"], [COLS.bal, "Balance"]);

function read(items: PdfItem[]) {
  const { table } = tableFromPdfItems(items);
  const h = findHeaderRow(table);
  return { table, ...buildTxns(table.slice(h + 1), guessMapping(table[h] ?? [])) };
}

describe("reading a PDF statement's table", () => {
  it("puts every word under the column it sits under, and skips the account details above", () => {
    const { txns } = read([
      ...at(1, 800, [30, "Account No: XXXX1234"], [300, "Period 01/10/2026 to 31/10/2026"]),
      ...header(1, 760),
      ...at(1, 745, [COLS.date, "01/10/2026"], [COLS.desc, "UPI/SURESH KIRANA"], [COLS.out, "1,200.00"], [COLS.bal, "8,800.00"]),
      ...at(1, 732, [COLS.date, "02/10/2026"], [COLS.desc, "NEFT RAMESH TRADERS"], [COLS.in, "5,000.00"], [COLS.bal, "13,800.00"]),
    ]);
    expect(txns).toMatchObject([
      { date: "2026-10-01", description: "UPI/SURESH KIRANA", direction: "OUT", amountPaise: 120000, balancePaise: 880000 },
      { date: "2026-10-02", description: "NEFT RAMESH TRADERS", direction: "IN", amountPaise: 500000, balancePaise: 1380000 },
    ]);
  });

  it("joins a description that wraps onto the next line", () => {
    const { txns } = read([
      ...header(1, 760),
      ...at(1, 745, [COLS.date, "01/10/2026"], [COLS.desc, "NEFT CR-HDFC0000123-RAMESH"], [COLS.in, "500.00"], [COLS.bal, "500.00"]),
      ...at(1, 736, [COLS.desc, "TRADERS PVT LTD"]),
      ...at(1, 723, [COLS.date, "02/10/2026"], [COLS.desc, "ATM CASH"], [COLS.out, "100.00"], [COLS.bal, "400.00"]),
    ]);
    expect(txns.map((t) => t.description)).toEqual(["NEFT CR-HDFC0000123-RAMESH TRADERS PVT LTD", "ATM CASH"]);
  });

  it("reads on across pages, skipping the header printed again and the page footer", () => {
    const { txns } = read([
      ...header(1, 760),
      ...at(1, 745, [COLS.date, "01/10/2026"], [COLS.desc, "ONE"], [COLS.in, "10.00"], [COLS.bal, "10.00"]),
      ...at(1, 40, [30, "This is a computer generated statement. Page 1"]),
      ...at(2, 800, [30, "Account No: XXXX1234"]),
      ...header(2, 760),
      ...at(2, 745, [COLS.date, "03/10/2026"], [COLS.desc, "TWO"], [COLS.out, "4.00"], [COLS.bal, "6.00"]),
    ]);
    expect(txns.map((t) => t.description)).toEqual(["ONE", "TWO"]);
    expect(checkBalances(txns)?.mismatches).toEqual([]);
  });

  it("understands a header split over two lines", () => {
    const { table } = tableFromPdfItems([
      ...at(1, 760, [COLS.date, "Txn"], [COLS.desc, "Description"], [COLS.out, "Withdrawal"], [COLS.in, "Deposit"], [COLS.bal, "Closing"]),
      ...at(1, 752, [COLS.date, "Date"], [COLS.out, "Amt."], [COLS.in, "Amt."], [COLS.bal, "Balance"]),
      ...at(1, 738, [COLS.date, "01/10/2026"], [COLS.desc, "X"], [COLS.in, "1.00"], [COLS.bal, "1.00"]),
    ]);
    expect(table[0]).toEqual(["Txn Date", "Description", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"]);
    expect(table).toHaveLength(2);
  });

  it("finds nothing in a PDF with no table", () => {
    expect(tableFromPdfItems(at(1, 700, [30, "Dear customer, your statement is attached."])).table).toEqual([]);
    expect(tableFromPdfItems([]).table).toEqual([]);
  });
});

describe("checking the running balance", () => {
  const t = (direction: "IN" | "OUT", amountPaise: number, balancePaise: number | null) => ({ date: "2026-10-01", description: "x", direction, amountPaise, balancePaise, ref: null });

  it("passes when every balance follows from the one before, oldest or newest first", () => {
    const rows = [t("IN", 1000, 1000), t("OUT", 300, 700), t("IN", 50, 750)];
    expect(checkBalances(rows)).toMatchObject({ checked: 2, order: "oldest-first", mismatches: [] });
    expect(checkBalances([...rows].reverse())).toMatchObject({ checked: 2, order: "newest-first", mismatches: [] });
  });

  it("points at the row after a missed or misread one", () => {
    const r = checkBalances([t("IN", 1000, 1000), t("OUT", 300, 700), /* missed: OUT 200 → 500 */ t("IN", 50, 550), t("IN", 50, 600)]);
    expect(r?.mismatches).toEqual([{ date: "2026-10-01", description: "x", amountPaise: 50, direction: "IN", expectedPaise: 750, shownPaise: 550 }]);
  });

  it("has nothing to check without a balance on every row", () => {
    expect(checkBalances([t("IN", 1, null), t("IN", 1, null)])).toBeNull();
    expect(checkBalances([t("IN", 1, 1), t("IN", 1, null)])).toBeNull();
    expect(checkBalances([t("IN", 1, 1)])).toBeNull();
  });
});
