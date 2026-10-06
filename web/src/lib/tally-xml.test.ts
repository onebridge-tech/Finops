import { describe, expect, it } from "vitest";
import { creditNoteVoucher, esc, receiptVoucher, salesVoucher, voucherXml } from "./tally-xml";

const inv = { number: "INV-5", date: "2026-10-06", party: "Lakshmi & Sons", taxablePaise: 100000, cgstPaise: 9000, sgstPaise: 9000, igstPaise: 0, roundOffPaise: -0, totalPaise: 118000 };

describe("tally xml", () => {
  it("escapes markup and drops control characters", () => {
    expect(esc(`A&B <"x"> 'y'\u0001`)).toBe("A&amp;B &lt;&quot;x&quot;&gt; &apos;y&apos;");
  });

  it("builds a balanced sales voucher with debits negative", () => {
    const x = salesVoucher(inv);
    expect(x).toContain("<DATE>20261006</DATE>");
    expect(x).toContain("<PARTYLEDGERNAME>Lakshmi &amp; Sons</PARTYLEDGERNAME>");
    expect(x).toContain("<LEDGERNAME>Lakshmi &amp; Sons</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-1180.00</AMOUNT>");
    expect(x).toContain("<LEDGERNAME>Output CGST</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>90.00</AMOUNT>");
    expect(x).not.toContain("Output IGST"); // zero lines are left out
  });

  it("puts a negative round-off on the debit side", () => {
    const x = salesVoucher({ ...inv, taxablePaise: 100010, totalPaise: 117990, roundOffPaise: -20 });
    expect(x).toContain("<LEDGERNAME>Round Off</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-0.20</AMOUNT>");
  });

  it("refuses a voucher that does not balance", () => {
    expect(() => voucherXml({ type: "Sales", number: "X", date: "2026-01-01", party: "P", narration: "", lines: [{ ledger: "P", paise: 100, side: "DR" }, { ledger: "Sales", paise: 99, side: "CR" }] })).toThrow(/balance/);
  });

  it("receipt: cash or bank on the debit side, party credited", () => {
    const cash = receiptVoucher({ number: "RCPT-1", date: "2026-10-06", party: "P", amountPaise: 150000, mode: "CASH" });
    expect(cash).toContain("<LEDGERNAME>Cash</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-1500.00</AMOUNT>");
    expect(receiptVoucher({ number: "RCPT-2", date: "2026-10-06", party: "P", amountPaise: 100, mode: "UPI" })).toContain("Bank Account");
  });

  it("credit note reverses the sides of a sale", () => {
    const x = creditNoteVoucher({ ...inv, number: "CN-1", reason: "Returned" });
    expect(x).toContain("VCHTYPE=\"Credit Note\"");
    expect(x).toContain("<LEDGERNAME>Lakshmi &amp; Sons</LEDGERNAME><ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE><AMOUNT>1180.00</AMOUNT>");
    expect(x).toContain("<LEDGERNAME>Sales Returns</LEDGERNAME><ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE><AMOUNT>-1000.00</AMOUNT>");
  });
});
