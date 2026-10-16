// A rough income tax worksheet for a small proprietor, to start the conversation with an accountant. It is NOT tax advice.
// The rules below are for resident individuals under the new regime, financial year 2026-27 (assessment year 2027-28).
// They must be checked every year: change the numbers here, and the page and the Excel pack follow.

export const TAX_RULES = {
  fy: "2026-27",
  /** Slab limits in rupees: income above `from` up to the next row is taxed at `rate`. */
  slabs: [
    { from: 0, rate: 0 },
    { from: 400_000, rate: 5 },
    { from: 800_000, rate: 10 },
    { from: 1_200_000, rate: 15 },
    { from: 1_600_000, rate: 20 },
    { from: 2_000_000, rate: 25 },
    { from: 2_400_000, rate: 30 },
  ],
  /** Section 87A: no tax when taxable income is within the limit, and the rebate is capped. */
  rebateLimit: 1_200_000,
  rebateMax: 60_000,
  cessPct: 4,
  /** Section 44AD: deemed profit as a share of turnover (digital receipts / other receipts). */
  presumptiveDigitalPct: 6,
  presumptiveOtherPct: 8,
  /** Turnover limit, raised when almost all receipts come through banks or UPI. */
  presumptiveLimit: 20_000_000,
  presumptiveLimitDigital: 30_000_000,
  digitalShareNeeded: 95,
} as const;

/** Tax on an income in rupees: slab tax, less the 87A rebate, plus cess. */
export function incomeTax(incomeRupees: number): { slabTax: number; rebate: number; cess: number; total: number } {
  const income = Math.max(0, Math.round(incomeRupees));
  const s = TAX_RULES.slabs;
  let tax = 0;
  for (let i = 0; i < s.length; i++) {
    const lo = s[i].from;
    const hi = i + 1 < s.length ? s[i + 1].from : Infinity;
    if (income > lo) tax += ((Math.min(income, hi) - lo) * s[i].rate) / 100;
  }
  const slabTax = Math.round(tax);
  const rebate = income <= TAX_RULES.rebateLimit ? Math.min(slabTax, TAX_RULES.rebateMax) : 0;
  const after = slabTax - rebate;
  const cess = Math.round((after * TAX_RULES.cessPct) / 100);
  return { slabTax, rebate, cess, total: after + cess };
}

export type TaxInput = {
  /** Sales before GST, after returns, plus cash sales (paise). */
  turnoverPaise: number;
  /** Of the money received from customers, the part that came by UPI, bank, card or cheque (paise). */
  digitalReceiptsPaise: number;
  /** All money received from customers (paise). */
  allReceiptsPaise: number;
  /** Profit from the books for the year (paise), before income tax. */
  bookProfitPaise: number;
};

export type TaxEstimate = {
  turnover: number;
  digitalShare: number; // percent of receipts that were digital
  presumptive: { eligible: boolean; limit: number; deemedProfit: number; tax: ReturnType<typeof incomeTax> };
  books: { profit: number; tax: ReturnType<typeof incomeTax> };
  notes: string[];
};

export function estimateTax(i: TaxInput): TaxEstimate {
  const turnover = Math.round(i.turnoverPaise / 100);
  const share = i.allReceiptsPaise > 0 ? Math.round((i.digitalReceiptsPaise / i.allReceiptsPaise) * 100) : 0;
  const limit = share >= TAX_RULES.digitalShareNeeded ? TAX_RULES.presumptiveLimitDigital : TAX_RULES.presumptiveLimit;
  const digital = (turnover * share) / 100;
  const deemed = Math.round((digital * TAX_RULES.presumptiveDigitalPct) / 100 + ((turnover - digital) * TAX_RULES.presumptiveOtherPct) / 100);
  const profit = Math.round(i.bookProfitPaise / 100);
  const notes = [
    `Rules used: resident individual, new regime, FY ${TAX_RULES.fy}, no other income and no deductions. A firm or company is taxed differently.`,
    "Presumptive (section 44AD): you declare a fixed share of turnover as profit and need not keep full books, if turnover is within the limit and you do not opt out.",
    "From your books: tax on the profit your entries show. If you declare less than the presumptive amount, books and an audit may be needed.",
  ];
  if (turnover > limit) notes.push(`Your turnover is above the presumptive limit of ₹${(limit / 100000).toLocaleString("en-IN")} lakh, so section 44AD cannot be used.`);
  if (profit < 0) notes.push("Your books show a loss. Ask your accountant how to carry it forward.");
  return {
    turnover, digitalShare: share,
    presumptive: { eligible: turnover <= limit, limit, deemedProfit: deemed, tax: incomeTax(deemed) },
    books: { profit, tax: incomeTax(profit) },
    notes,
  };
}
