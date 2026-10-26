import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

describe("password hashing", () => {
  it("verifies the right password and refuses a wrong one", async () => {
    const h = await hashPassword("tea at the counter 42");
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword("tea at the counter 42", h)).toBe(true);
    expect(await verifyPassword("tea at the counter 43", h)).toBe(false);
  });

  it("salts every hash, so the same password never looks the same twice", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("refuses when there is no stored hash or it is malformed", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});

describe("passwordProblem", () => {
  it("accepts a reasonable password", () => {
    expect(passwordProblem("Lakshmi stores 2026", "ravi@shop.in")).toBeNull();
  });
  it("refuses short, common, repeated and all-digit passwords", () => {
    expect(passwordProblem("short1")).toMatch(/at least 8/);
    expect(passwordProblem("Password123")).toMatch(/too common/);
    expect(passwordProblem("aaaaaaaaaa")).toMatch(/repeated/);
    expect(passwordProblem("98480123")).toMatch(/letters/);
    expect(passwordProblem("x".repeat(129))).toMatch(/at most/);
  });
  it("refuses a password built from the email name", () => {
    expect(passwordProblem("ravikumar2026", "ravikumar@gmail.com")).toMatch(/email name/);
  });
});
