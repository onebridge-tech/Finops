import { describe, expect, it } from "vitest";
import { parseNoteResponse } from "./note-parse";

const today = "2026-10-16";

describe("parseNoteResponse", () => {
  it("reads rows from a reply wrapped in code fences", () => {
    const text = "```json\n" + JSON.stringify({ page_date: "2026-10-15", rows: [{ date: null, item: "టీ", qty: 2, amount: 20, type: "IN", confidence: 0.9 }, { date: "2026-10-14", item: "Milk", qty: null, amount: "₹1,200", type: "OUT", confidence: 0.7 }], problems: [] }) + "\n```";
    const r = parseNoteResponse(text, today);
    expect(r.pageDate).toBe("2026-10-15");
    expect(r.rows).toEqual([
      { date: "2026-10-15", item: "టీ", qty: 2, amountPaise: 2000, type: "IN", confidence: 0.9 },
      { date: "2026-10-14", item: "Milk", qty: null, amountPaise: 120000, type: "OUT", confidence: 0.7 },
    ]);
  });

  it("uses today for lines with no date and ignores dates in the future", () => {
    const r = parseNoteResponse(JSON.stringify({ page_date: "2999-01-01", rows: [{ date: "2999-01-01", item: "Tea", amount: 10, type: "IN" }] }), today);
    expect(r.pageDate).toBeNull();
    expect(r.rows[0].date).toBe(today);
  });

  it("drops lines with no item or a bad amount and says so", () => {
    const r = parseNoteResponse(JSON.stringify({ rows: [{ item: "", amount: 5 }, { item: "Tea", amount: -3 }, { item: "Tea", amount: "abc" }, { item: "Sugar", amount: 40 }] }), today);
    expect(r.rows).toHaveLength(1);
    expect(r.problems.join(" ")).toMatch(/3 lines could not be read/);
  });

  it("treats anything that is not OUT as a sale, and clamps confidence", () => {
    const r = parseNoteResponse(JSON.stringify({ rows: [{ item: "Tea", amount: 10, type: "sale", confidence: 5 }] }), today);
    expect(r.rows[0]).toMatchObject({ type: "IN", confidence: 1 });
  });

  it("gives a helpful message when the reply is not JSON", () => {
    const r = parseNoteResponse("Sorry, I cannot read this.", today);
    expect(r.rows).toEqual([]);
    expect(r.problems[0]).toMatch(/try the photo again/);
  });

  it("copes with an empty page", () => {
    const r = parseNoteResponse(JSON.stringify({ rows: [] }), today);
    expect(r.problems[0]).toMatch(/No lines/);
  });
});
