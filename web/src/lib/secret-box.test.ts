import { describe, expect, it } from "vitest";
import { isEncrypted, maskSecret, openSecret, sealSecret } from "./secret-box";

describe("secret box", () => {
  it("round-trips and does not store the text in the clear", () => {
    const s = sealSecret("sk-live-1234567890", "server secret");
    expect(isEncrypted(s)).toBe(true);
    expect(s).not.toContain("1234567890");
    expect(openSecret(s, "server secret")).toBe("sk-live-1234567890");
  });
  it("gives a different sealed text each time", () => {
    expect(sealSecret("a", "k")).not.toBe(sealSecret("a", "k"));
  });
  it("cannot be opened with another secret or after a change", () => {
    const s = sealSecret("hello", "right");
    expect(openSecret(s, "wrong")).toBeNull();
    expect(openSecret(s.slice(0, -4) + "AAAA", "right")).toBeNull();
    expect(openSecret("plain text", "right")).toBeNull();
  });
  it("masks a key to its last four characters", () => {
    expect(maskSecret("abcdefghij")).toBe("••••ghij");
    expect(maskSecret("abc")).toBe("••••");
  });
});
