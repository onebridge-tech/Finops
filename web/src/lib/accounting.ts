// Accountant view (LO-02): Tally-style vouchers, ledger groups and Dr/Cr balances.
// The data is the same as simple mode; only the vocabulary changes. Pure.
import { formatINR } from "./money";

type EntryLike = { direction: string; source: string; paymentMode: string | null; reversalOfId?: string | null };

/**
 * Voucher type an accountant would book this entry as. Our GAVE = debit to the
 * party's ledger, GOT = credit.
 */
export function voucherType(e: EntryLike, partyType: string): string {
  if (e.source === "INVOICE") return "Sales";
  if (e.source === "OPENING") return "Opening balance";
  if (e.source === "REVERSAL") return "Journal (reversal)";
  if (e.direction === "GOT") {
    if (e.paymentMode) return e.paymentMode === "CASH" ? "Receipt (cash)" : "Receipt (bank)";
    // A credit without a payment mode is goods in from a supplier, or an unspecified receipt from a customer.
    return partyType === "SUPPLIER" ? "Purchase" : "Receipt";
  }
  return partyType === "SUPPLIER" ? "Payment" : "Sales (credit)";
}

/** "₹1,200.00 Dr" for a debit balance (party owes us), "Cr" for credit. */
export function drCr(paise: number): string {
  if (paise === 0) return formatINR(0);
  return `${formatINR(Math.abs(paise))} ${paise > 0 ? "Dr" : "Cr"}`;
}

/** Tally ledger group for a party, from its type and current balance. */
export function ledgerGroup(type: string, balance: number): string {
  if (type === "LEAD") return "Prospect (no ledger)";
  if (type === "SUPPLIER") return "Sundry Creditors";
  if (type === "CUSTOMER") return "Sundry Debtors";
  return balance < 0 ? "Sundry Creditors" : "Sundry Debtors";
}
