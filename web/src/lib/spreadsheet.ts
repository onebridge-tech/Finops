import "server-only";
import ExcelJS from "exceljs";
import { parseCsv, toCsv } from "./csv";

export const MAX_IMPORT_ROWS = 5000;

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
}

/** Reads the first sheet of an .xlsx file, or a .csv file, into rows of strings. */
export async function readTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
    return parseCsv(await file.text());
  }
  if (!name.endsWith(".xlsx")) throw new Error("Upload an .xlsx or .csv file (older .xls files: save as .xlsx first)");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value).trim());
    if (cells.some(Boolean)) rows.push(cells);
  });
  return rows;
}

export type TableFormat = "csv" | "xlsx" | "json";

/** Builds a download in the requested format from a header and rows. */
export async function writeTable(format: TableFormat, sheet: string, header: string[], rows: (string | number | null)[][]): Promise<{ body: Uint8Array<ArrayBuffer> | string; type: string; ext: string }> {
  if (format === "json") {
    const objects = rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
    return { body: JSON.stringify(objects, null, 2), type: "application/json", ext: "json" };
  }
  if (format === "csv") return { body: toCsv(header, rows), type: "text/csv; charset=utf-8", ext: "csv" };
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet.slice(0, 31));
  ws.addRow(header).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  ws.columns.forEach((col) => { col.width = Math.min(40, Math.max(10, ...(col.values ?? []).map((v) => String(v ?? "").length + 2))); });
  const buf = await wb.xlsx.writeBuffer();
  return { body: new Uint8Array(buf as ArrayBuffer), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" };
}
