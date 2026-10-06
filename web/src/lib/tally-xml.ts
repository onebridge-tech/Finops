// Tally voucher XML (IN-01). Pure: builds the <TALLYMESSAGE> fragments the connector
// agent wraps in an import envelope and posts to Tally's local HTTP port.

export const TALLY_LEDGERS = {
  sales: "Sales",
  salesReturns: "Sales Returns",
  cgst: "Output CGST",
  sgst: "Output SGST",
  igst: "Output IGST",
  roundOff: "Round Off",
  cash: "Cash",
  bank: "Bank Account",
} as const;
export type TallyLedgers = typeof TALLY_LEDGERS;

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    // control characters are not valid in XML 1.0
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** "2026-10-06" → "20261006" */
export const tallyDate = (ymd: string) => ymd.replace(/-/g, "");

const amt = (paise: number) => (paise / 100).toFixed(2);

export type VLine = { ledger: string; paise: number; side: "DR" | "CR" };
export type Voucher = { type: string; number: string; date: string; party: string; narration: string; lines: VLine[] };

/** One voucher. Tally wants debits as negative amounts with ISDEEMEDPOSITIVE=Yes. */
export function voucherXml(v: Voucher): string {
  const dr = v.lines.filter((l) => l.side === "DR").reduce((s, l) => s + l.paise, 0);
  const cr = v.lines.filter((l) => l.side === "CR").reduce((s, l) => s + l.paise, 0);
  if (dr !== cr) throw new Error(`Voucher ${v.number} does not balance (Dr ${amt(dr)} vs Cr ${amt(cr)})`);
  const lines = v.lines
    .filter((l) => l.paise !== 0)
    .map((l) =>
      `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${esc(l.ledger)}</LEDGERNAME><ISDEEMEDPOSITIVE>${l.side === "DR" ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${l.side === "DR" ? "-" : ""}${amt(l.paise)}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
    )
    .join("");
  return (
    `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="${esc(v.type)}" ACTION="Create" OBJVIEW="Accounting Voucher View">` +
    `<DATE>${tallyDate(v.date)}</DATE><VOUCHERTYPENAME>${esc(v.type)}</VOUCHERTYPENAME><VOUCHERNUMBER>${esc(v.number)}</VOUCHERNUMBER>` +
    `<PARTYLEDGERNAME>${esc(v.party)}</PARTYLEDGERNAME><NARRATION>${esc(v.narration)}</NARRATION>${lines}</VOUCHER></TALLYMESSAGE>`
  );
}

type Tax = { taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; roundOffPaise: number; totalPaise: number };

/** Tax and round-off lines on the side opposite the party. */
function taxLines(t: Tax, side: "DR" | "CR", names: TallyLedgers): VLine[] {
  const out: VLine[] = [
    { ledger: names.cgst, paise: t.cgstPaise, side },
    { ledger: names.sgst, paise: t.sgstPaise, side },
    { ledger: names.igst, paise: t.igstPaise, side },
  ];
  // A positive round-off was added to the total, so it sits with the taxes; a negative one was taken off.
  if (t.roundOffPaise > 0) out.push({ ledger: names.roundOff, paise: t.roundOffPaise, side });
  if (t.roundOffPaise < 0) out.push({ ledger: names.roundOff, paise: -t.roundOffPaise, side: side === "DR" ? "CR" : "DR" });
  return out;
}

export function salesVoucher(i: Tax & { number: string; date: string; party: string }, names: TallyLedgers = TALLY_LEDGERS): string {
  return voucherXml({
    type: "Sales", number: i.number, date: i.date, party: i.party, narration: `Invoice ${i.number} (from Business Ledger)`,
    lines: [{ ledger: i.party, paise: i.totalPaise, side: "DR" }, { ledger: names.sales, paise: i.taxablePaise, side: "CR" }, ...taxLines(i, "CR", names)],
  });
}

export function creditNoteVoucher(n: Tax & { number: string; date: string; party: string; reason: string }, names: TallyLedgers = TALLY_LEDGERS): string {
  return voucherXml({
    type: "Credit Note", number: n.number, date: n.date, party: n.party, narration: `Credit note ${n.number}: ${n.reason}`,
    lines: [{ ledger: n.party, paise: n.totalPaise, side: "CR" }, { ledger: names.salesReturns, paise: n.taxablePaise, side: "DR" }, ...taxLines(n, "DR", names)],
  });
}

export function receiptVoucher(r: { number: string; date: string; party: string; amountPaise: number; mode: string | null; note?: string | null }, names: TallyLedgers = TALLY_LEDGERS): string {
  return voucherXml({
    type: "Receipt", number: r.number, date: r.date, party: r.party, narration: r.note ? `Receipt ${r.number}: ${r.note}` : `Receipt ${r.number}`,
    lines: [{ ledger: r.mode === "CASH" || !r.mode ? names.cash : names.bank, paise: r.amountPaise, side: "DR" }, { ledger: r.party, paise: r.amountPaise, side: "CR" }],
  });
}
