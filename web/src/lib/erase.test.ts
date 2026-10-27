import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./files", () => ({ removeBusinessFiles: async () => {} }));
vi.mock("./site-settings", () => ({ readSite: async () => ({ deleteDaysNum: 30 }) }));

const { BUSINESS_TABLES } = await import("./erase");

describe("erasing a shop", () => {
  const models = Prisma.dmmf.datamodel.models;
  const listed = BUSINESS_TABLES.map(([name]) => name);

  it("reaches every table that holds a shop's rows", () => {
    // A table with a businessId, or one hanging off such a table (invoice lines and the like), must be listed.
    const scoped = new Set(models.filter((m) => m.fields.some((f) => f.name === "businessId")).map((m) => m.name));
    const children = models.filter((m) => m.fields.some((f) => f.kind === "object" && f.relationFromFields?.length && scoped.has(f.type) && f.type !== "Business")).map((m) => m.name);
    for (const name of [...scoped, ...children]) expect(listed, `${name} is not erased with its shop: add it to BUSINESS_TABLES`).toContain(name);
  });

  it("removes rows before the rows they point at", () => {
    for (const m of models) {
      if (!listed.includes(m.name)) continue;
      for (const f of m.fields) {
        if (f.kind !== "object" || !f.relationFromFields?.length || f.type === m.name || f.type === "Business" || f.type === "User") continue;
        expect(listed.indexOf(m.name), `${m.name} points at ${f.type}, so it must be removed first`).toBeLessThan(listed.indexOf(f.type));
      }
    }
  });
});
