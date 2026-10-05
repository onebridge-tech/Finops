import { describe, expect, it } from "vitest";
import { chainHash, verifyChain, type ChainEvent } from "./audit-chain";

function build(n: number): ChainEvent[] {
  const out: ChainEvent[] = [];
  let prev: string | null = null;
  for (let i = 1; i <= n; i++) {
    const f = { seq: i, businessId: "b", actorId: "u", action: "create", entity: "LedgerEntry", entityId: `e${i}`, data: `{"amountPaise":"${i * 100}"}`, createdAt: `2026-10-05T10:0${i}:00.000Z` };
    const hash = chainHash(prev, f);
    out.push({ ...f, id: `id${i}`, prevHash: prev, hash });
    prev = hash;
  }
  return out;
}

describe("audit hash chain", () => {
  it("verifies an untouched chain", () => {
    expect(verifyChain(build(5))).toEqual({ ok: true, checked: 5 });
  });
  it("detects an edited amount", () => {
    const c = build(5);
    c[2] = { ...c[2], data: '{"amountPaise":"1"}' };
    expect(verifyChain(c)).toMatchObject({ ok: false, at: 3, reason: "Event #3 was changed after it was recorded" });
  });
  it("detects a deleted event", () => {
    const c = build(5);
    c.splice(1, 1);
    expect(verifyChain(c)).toMatchObject({ ok: false, at: 2, reason: "Event #2 is missing" });
  });
  it("detects an event re-hashed to cover an edit", () => {
    const c = build(4);
    const edited = { ...c[1], action: "delete" };
    c[1] = { ...edited, hash: chainHash(edited.prevHash, edited) };
    expect(verifyChain(c)).toMatchObject({ ok: false, at: 3, reason: "Event #3 does not follow the one before it" });
  });
});
