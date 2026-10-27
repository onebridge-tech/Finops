import { tableFromPdfItems, type PdfItem } from "@/lib/pdf-table";

// Opens a PDF bank statement here in the browser. The file and its password never leave the device: only the rows
// of transactions read from it are sent on, the same way rows from an Excel file are.

export type PdfRead =
  | { ok: true; table: string[][]; pages: number }
  | { ok: false; reason: "password" | "wrong-password" | "scanned" | "no-table" | "broken" };

export async function readPdfStatement(file: File, password?: string): Promise<PdfRead> {
  // The "legacy" build also runs on older phones' browsers.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // The bundler turns this into the address of its own copy of the reader's worker script.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  let doc;
  try {
    // pdf.js 5 never evaluates code from a PDF (the old isEvalSupported switch is gone), so text is all we read from it.
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), password: password || undefined }).promise;
  } catch (e) {
    if (e && typeof e === "object" && (e as { name?: string }).name === "PasswordException") {
      return { ok: false, reason: (e as { code?: number }).code === pdfjs.PasswordResponses.INCORRECT_PASSWORD ? "wrong-password" : "password" };
    }
    return { ok: false, reason: "broken" };
  }
  try {
    const items: PdfItem[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      for (const it of content.items) {
        if (!("str" in it) || !it.str.trim()) continue;
        items.push({ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number, w: it.width, page: n });
      }
      page.cleanup();
    }
    if (items.length === 0) return { ok: false, reason: "scanned" };
    const { table, pages } = tableFromPdfItems(items);
    return table.length > 1 ? { ok: true, table, pages } : { ok: false, reason: "no-table" };
  } finally {
    // Drop the opened document (and with it the password) from memory.
    await doc.destroy();
  }
}
