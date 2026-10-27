import { guessMapping, parseDate } from "./bank-import";

// Turning the text of a PDF bank statement into the same rows of cells an Excel statement gives. Pure, so it is
// easy to test; the PDF itself is opened in the browser (components/pdf-statement.ts) and never reaches the server.
//
// A PDF has no table, only words placed on the page. The statement's header line ("Date  Narration  Withdrawal
// Deposit  Balance") gives the columns; every word below it goes to the column it sits under. A line that starts
// with a date begins a transaction; a line with words only under the description is the rest of a long description.

/** One run of text on a page. x and y are in PDF points, y counted up from the bottom of the page. */
export type PdfItem = { str: string; x: number; y: number; w: number; page: number };

type Chunk = { text: string; x0: number; x1: number };
type Line = { page: number; y: number; chunks: Chunk[] };
type Column = { x0: number; x1: number };

const LINE_TOLERANCE = 2.5; // words this close vertically are on the same line
const WORD_GAP = 4; // words closer than this horizontally belong to the same cell

function linesOf(items: PdfItem[]): Line[] {
  const byPage = new Map<number, PdfItem[]>();
  for (const it of items) if (it.str.trim()) byPage.set(it.page, [...(byPage.get(it.page) ?? []), it]);
  const lines: Line[] = [];
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    const sorted = byPage.get(page)!.sort((a, b) => b.y - a.y || a.x - b.x);
    const groups: PdfItem[][] = [];
    for (const it of sorted) {
      const g = groups.at(-1);
      if (g && Math.abs(g[0]!.y - it.y) <= LINE_TOLERANCE) g.push(it);
      else groups.push([it]);
    }
    for (const g of groups) {
      g.sort((a, b) => a.x - b.x);
      const chunks: Chunk[] = [];
      for (const it of g) {
        const last = chunks.at(-1);
        if (last && it.x - last.x1 < WORD_GAP) {
          last.text += (it.x - last.x1 > 0.5 && !last.text.endsWith(" ") ? " " : "") + it.str;
          last.x1 = Math.max(last.x1, it.x + it.w);
        } else chunks.push({ text: it.str, x0: it.x, x1: it.x + it.w });
      }
      for (const c of chunks) c.text = c.text.replace(/\s+/g, " ").trim();
      lines.push({ page, y: g[0]!.y, chunks: chunks.filter((c) => c.text) });
    }
  }
  return lines;
}

const isHeader = (texts: string[]) => {
  const g = guessMapping(texts);
  return g.date !== undefined && (g.debit !== undefined || g.credit !== undefined || g.amount !== undefined);
};

/** Some statements print header words on two lines ("Withdrawal" over "Amt."). Words that sit over each other are joined. */
function mergeHeaderLines(a: Line, b: Line): Chunk[] {
  const out = a.chunks.map((c) => ({ ...c }));
  for (const c of b.chunks) {
    const over = out.find((o) => Math.min(o.x1, c.x1) - Math.max(o.x0, c.x0) > 0);
    if (over) { over.text = `${over.text} ${c.text}`; over.x0 = Math.min(over.x0, c.x0); over.x1 = Math.max(over.x1, c.x1); }
    else out.push({ ...c });
  }
  return out.sort((x, y) => x.x0 - y.x0);
}

/** The column a cell belongs to: the one it overlaps most, or else the nearest. */
function columnOf(c: Chunk, cols: Column[]): number {
  let best = 0, bestScore = -Infinity;
  cols.forEach((col, i) => {
    const overlap = Math.min(col.x1, c.x1) - Math.max(col.x0, c.x0);
    const score = overlap > 0 ? overlap : -Math.abs((col.x0 + col.x1) / 2 - (c.x0 + c.x1) / 2) - 1e6;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

export type PdfTable = { table: string[][]; pages: number };

/**
 * Rows of cells, the header first, ready for the same column matching an Excel statement goes through. Returns an
 * empty table when no header line was found (a scanned statement has no text at all).
 */
export function tableFromPdfItems(items: PdfItem[]): PdfTable {
  const lines = linesOf(items);
  const pages = new Set(items.map((i) => i.page)).size;
  let headerAt = -1, header: Chunk[] = [], headerRows = 1;
  const texts = (l: Line) => l.chunks.map((c) => c.text);
  // A second header line sits just under the first and holds only words, no dates or amounts.
  const continuesHeader = (a: Line, b: Line | undefined) =>
    !!b && b.page === a.page && a.y - b.y < 12 && b.chunks.every((c) => !parseDate(c.text) && !/\d[\d,]*\.\d{2}/.test(c.text));
  const known = (cs: Chunk[]) => Object.keys(guessMapping(cs.map((c) => c.text))).length;
  headerAt = lines.findIndex((l) => isHeader(texts(l)));
  if (headerAt >= 0) {
    // The header may have a line of words just above or below it; it is joined only when more columns make sense.
    const line = lines[headerAt]!;
    header = line.chunks;
    const above = lines[headerAt - 1];
    const below = lines[headerAt + 1];
    if (above && continuesHeader(above, line) && known(mergeHeaderLines(above, line)) > known(header)) {
      header = mergeHeaderLines(above, line); headerAt -= 1; headerRows = 2;
    } else if (continuesHeader(line, below) && known(mergeHeaderLines(line, below!)) >= known(header)) {
      header = mergeHeaderLines(line, below!); headerRows = 2;
    }
  } else {
    // Headers whose words are split over two lines ("Withdrawal" over "Amt.") are only recognised together.
    headerAt = lines.findIndex((l, i) => continuesHeader(l, lines[i + 1]) && isHeader(mergeHeaderLines(l, lines[i + 1]!).map((c) => c.text)));
    if (headerAt >= 0) { header = mergeHeaderLines(lines[headerAt]!, lines[headerAt + 1]!); headerRows = 2; }
  }
  if (headerAt < 0) return { table: [], pages };
  const headerTexts = header.map((c) => c.text);
  const headerKey = headerTexts.join("|").toLowerCase();
  const cols: Column[] = header.map((c) => ({ x0: c.x0, x1: c.x1 }));
  const mapping = guessMapping(headerTexts);
  const dateCol = mapping.date!;
  const descCol = mapping.description;

  const rows: string[][] = [];
  let prev: { row: string[]; line: Line; gap: number } | null = null;
  for (let i = headerAt + headerRows; i < lines.length; i++) {
    const line = lines[i]!;
    const texts = line.chunks.map((c) => c.text);
    // The header printed again at the top of the next page.
    if (texts.join("|").toLowerCase() === headerKey || isHeader(texts)) { prev = null; continue; }
    const row: string[] = cols.map(() => "");
    for (const c of line.chunks) {
      const k = columnOf(c, cols);
      row[k] = row[k] ? `${row[k]} ${c.text}` : c.text;
    }
    if (parseDate(row[dateCol] ?? "")) {
      rows.push(row);
      prev = { row, line, gap: prev && prev.line.page === line.page ? prev.line.y - line.y : 0 };
      continue;
    }
    // Words only under the description, just below a transaction: the rest of its description.
    const used = row.map((v, k) => (v ? k : -1)).filter((k) => k >= 0);
    const close = prev && prev.line.page === line.page && prev.line.y - line.y < Math.max(prev.gap || 14, 14) * 1.6;
    if (prev && close && descCol !== undefined && used.length === 1 && used[0] === descCol) {
      prev.row[descCol] = `${prev.row[descCol]} ${row[descCol]}`.trim();
      prev.line = line;
      continue;
    }
    // Anything else (opening balance, totals, page footers, addresses) is kept as its own row so nothing is
    // silently lost; rows without a date are skipped when the transactions are read.
    if (/opening|closing|total|balance|b\/f|c\/f/i.test(texts.join(" "))) rows.push(row);
    prev = null;
  }
  return { table: [headerTexts, ...rows], pages };
}
