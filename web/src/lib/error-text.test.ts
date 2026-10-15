import { describe, expect, it } from "vitest";
import { fingerprint, scrub } from "./error-text";

describe("error text", () => {
  it("takes emails, long numbers and ids out of a message", () => {
    expect(scrub("Unique constraint failed for ravi@example.com")).toBe("Unique constraint failed for <email>");
    expect(scrub("No user 919000000001 here")).toBe("No user <number> here");
    expect(scrub("Record cmv81dbo20004fj3mq6twubjy not found")).toBe("Record <id> not found");
  });

  it("groups the same problem together even when numbers differ", () => {
    const a = fingerprint("SERVER", "/parties/[id]", "Item 12 failed");
    const b = fingerprint("SERVER", "/parties/[id]", "Item 98 failed");
    expect(a).toBe(b);
    expect(fingerprint("SERVER", "/parties/[id]", "Different problem")).not.toBe(a);
    expect(fingerprint("ACTION", "/parties/[id]", "Item 12 failed")).not.toBe(a);
  });

  it("keeps messages to a safe length", () => {
    expect(scrub("word ".repeat(400)).length).toBe(500);
  });
});
