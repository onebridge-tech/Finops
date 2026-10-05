import { roundHalfUp, type Paise } from "./money";

export type LineInput = {
  description: string;
  qtyMilli: number; // quantity × 1000
  ratePaise: Paise;
  taxRateBp: number; // 1800 = 18%
};

export type LineTotals = { taxable: Paise; cgst: Paise; sgst: Paise; igst: Paise; total: Paise };

export type InvoiceTotals = LineTotals & { roundOff: Paise; lines: LineTotals[] };

export const GST_RATES_BP = [0, 25, 300, 500, 1200, 1800, 2800];

/**
 * Tax is computed per line and rounded to the paisa. Intra-state supplies split
 * the rate equally into CGST and SGST (each rounded separately); inter-state
 * supplies use IGST. The grand total is rounded to the nearest rupee.
 */
export function computeLine(line: LineInput, interState: boolean): LineTotals {
  const taxable = roundHalfUp((line.qtyMilli * line.ratePaise) / 1000);
  if (interState) {
    const igst = roundHalfUp((taxable * line.taxRateBp) / 10000);
    return { taxable, cgst: 0, sgst: 0, igst, total: taxable + igst };
  }
  const half = roundHalfUp((taxable * line.taxRateBp) / 20000);
  return { taxable, cgst: half, sgst: half, igst: 0, total: taxable + 2 * half };
}

export function computeInvoice(lines: LineInput[], interState: boolean): InvoiceTotals {
  const computed = lines.map((l) => computeLine(l, interState));
  const sum = (k: keyof LineTotals) => computed.reduce((a, l) => a + l[k], 0);
  const exact = sum("total");
  const rounded = roundHalfUp(exact / 100) * 100;
  return {
    taxable: sum("taxable"),
    cgst: sum("cgst"),
    sgst: sum("sgst"),
    igst: sum("igst"),
    roundOff: rounded - exact,
    total: rounded,
    lines: computed,
  };
}

/** Place of supply differs from the supplier's state → IGST. */
export function isInterState(supplierState: string, placeOfSupply: string): boolean {
  return supplierState !== placeOfSupply;
}
