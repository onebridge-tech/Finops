#!/usr/bin/env node
// Business Ledger ⇄ Tally connector agent.
//
// Run this on the Windows PC where Tally is open (Tally must have its HTTP/XML port enabled:
// F1 Help → Settings → Connectivity → "TallyPrime acts as: Server", port 9000).
// Needs Node.js 18 or newer. No other installs.
//
//   set BLEDGER_URL=https://your-ledger-site
//   set BLEDGER_KEY=blt_...            (from Settings → Tally in the app)
//   set TALLY_COMPANY=My Company Ltd    (exact name of the open company)
//   node tally-agent.mjs                (add --once to run a single sync, or --every=300 for seconds)
//
// It sends new invoices, receipts and credit notes to Tally as vouchers, and reads ledgers,
// stock items and outstanding balances back so the app can flag differences. The ledgers it
// posts to (Sales, Sales Returns, Output CGST/SGST/IGST, Round Off, Cash, Bank Account) must
// already exist in the company. It has been tested against a stand-in for Tally, not yet a
// real Tally installation; try it on a test company first.

const BASE = (process.env.BLEDGER_URL || "").replace(/\/$/, "");
const KEY = process.env.BLEDGER_KEY || "";
const TALLY = process.env.TALLY_URL || "http://localhost:9000";
const COMPANY = process.env.TALLY_COMPANY || "";
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const everySec = Number(args.every || 300);

if (!BASE || !KEY || !COMPANY) {
  console.error("Set BLEDGER_URL, BLEDGER_KEY and TALLY_COMPANY first (see the notes at the top of this file).");
  process.exit(1);
}

const api = async (path, body) => {
  const res = await fetch(`${BASE}/api/tally/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

const tally = async (xml) => {
  const res = await fetch(TALLY, { method: "POST", headers: { "Content-Type": "text/xml" }, body: xml });
  return res.text();
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (xml, name) => (xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`)) || [])[1];

const importEnvelope = (message) =>
  `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME>` +
  `<STATICVARIABLES><SVCURRENTCOMPANY>${esc(COMPANY)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${message}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;

const collectionEnvelope = (id, type, fetchFields) =>
  `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${id}</ID></HEADER><BODY><DESC>` +
  `<STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVCURRENTCOMPANY>${esc(COMPANY)}</SVCURRENTCOMPANY></STATICVARIABLES>` +
  `<TDL><TDLMESSAGE><COLLECTION NAME="${id}" ISMODIFY="No"><TYPE>${type}</TYPE><FETCH>${fetchFields}</FETCH></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

async function pushVouchers() {
  const { vouchers } = await api("pending");
  if (!vouchers.length) return console.log("Nothing new to send to Tally.");
  const results = [];
  for (const v of vouchers) {
    try {
      const reply = await tally(importEnvelope(v.xml));
      const created = Number(tag(reply, "CREATED") || 0);
      const altered = Number(tag(reply, "ALTERED") || 0);
      const errors = Number(tag(reply, "ERRORS") || 0);
      const lineError = tag(reply, "LINEERROR");
      const ok = created + altered > 0 && errors === 0 && !lineError;
      results.push({ ref: v.ref, ok, message: `${v.kind} ${v.number}: ` + (ok ? "Posted to Tally" : unesc(lineError || `Tally did not accept it (${reply.slice(0, 120)})`)) });
      console.log(`${ok ? "✓" : "✗"} ${v.kind} ${v.number}${ok ? "" : " — " + results.at(-1).message}`);
    } catch (e) {
      results.push({ ref: v.ref, ok: false, message: `${v.kind} ${v.number}: could not reach Tally (${e.message})` });
      console.log(`✗ ${v.kind} ${v.number} — could not reach Tally`);
    }
  }
  await api("ack", { results });
}

const blocks = (xml, name) => [...xml.matchAll(new RegExp(`<${name}\\b([^>]*)>([\\s\\S]*?)</${name}>`, "g"))];
const attrName = (attrs) => unesc((attrs.match(/NAME="([^"]*)"/) || [])[1] || "");

async function pullAll() {
  const body = { ledgers: [], items: [], outstanding: [] };
  const led = await tally(collectionEnvelope("BLLedgers", "Ledger", "Name,Parent,PartyGSTIN,LedgerPhone,ClosingBalance"));
  for (const [, attrs, inner] of blocks(led, "LEDGER")) {
    const parent = unesc(tag(inner, "PARENT") || "");
    const name = attrName(attrs);
    if (!name || !/debtor|creditor/i.test(parent)) continue;
    body.ledgers.push({ name, parent, gstin: tag(inner, "PARTYGSTIN") || "", phone: tag(inner, "LEDGERPHONE") || "" });
    const closing = Number(String(tag(inner, "CLOSINGBALANCE") || "0").replace(/[^0-9.\-]/g, "")) || 0;
    // Tally shows what a debtor owes as a negative (debit) balance.
    if (/debtor/i.test(parent)) body.outstanding.push({ party: name, amountPaise: Math.round(-closing * 100) });
  }
  const stock = await tally(collectionEnvelope("BLItems", "StockItem", "Name,BaseUnits"));
  for (const [, attrs, inner] of blocks(stock, "STOCKITEM")) {
    const name = attrName(attrs);
    if (name) body.items.push({ name, unit: unesc(tag(inner, "BASEUNITS") || "pcs") });
  }
  const r = await api("pull", body);
  console.log(`Read from Tally: ${r.created} added, ${r.matched} matched, ${r.conflicts} to review in the app.`);
}

async function once() {
  try { await pushVouchers(); } catch (e) { console.error("Sending vouchers failed:", e.message); }
  try { await pullAll(); } catch (e) { console.error("Reading from Tally failed:", e.message); }
}

await once();
if (!("once" in args)) setInterval(once, everySec * 1000);
