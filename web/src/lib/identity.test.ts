import { describe, expect, it } from "vitest";
import { normalizeEmail, userContact, userLabel } from "./identity";

describe("identity", () => {
  it("cleans and checks email addresses", () => {
    expect(normalizeEmail("  Sandeep@Example.COM ")).toBe("sandeep@example.com");
    expect(normalizeEmail("no-at-sign")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("a b@c.com")).toBeNull();
    expect(normalizeEmail(`${"x".repeat(250)}@a.com`)).toBeNull();
  });

  it("names a person by name, then phone, then email", () => {
    expect(userLabel({ name: "Ravi", phone: "919000000001" })).toBe("Ravi");
    expect(userLabel({ name: null, phone: "919000000001", email: "r@x.com" })).toBe("+919000000001");
    expect(userLabel({ name: "", phone: null, email: "r@x.com" })).toBe("r@x.com");
    expect(userLabel(null)).toBe("Former member");
  });

  it("lists every contact on one line", () => {
    expect(userContact({ phone: "919000000001", email: "r@x.com" })).toBe("+919000000001 · r@x.com");
    expect(userContact({ phone: null, email: null })).toBe("—");
  });
});
