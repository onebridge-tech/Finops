import { describe, expect, it } from "vitest";
import { checkTemplate, defaultTemplateText, fillTemplate, renderMessage, TEMPLATE_KINDS, type TemplateVars } from "./templates";

const sample: TemplateVars = { party: "Ravi", business: "Sri Tea", link: "https://x.test/s/abc", amountPaise: 123450, balancePaise: 98765, number: "INV-7", date: "14 Oct 2026" };

describe("editable message templates", () => {
  it("shows the built-in wording as placeholders", () => {
    const t = defaultTemplateText("REMINDER", "en");
    expect(t).toContain("{party}");
    expect(t).toContain("{business}");
    expect(t).toContain("{link}");
    expect(t).not.toMatch(/\d{3,}/); // no stray sample numbers left in
  });

  it("filling the default text gives exactly the built-in message, in every language and kind", () => {
    for (const lang of ["en", "hi", "te", "ta", "kn"]) {
      for (const { kind } of TEMPLATE_KINDS) {
        expect(fillTemplate(defaultTemplateText(kind, lang), lang, sample)).toBe(renderMessage(kind, lang, sample));
      }
    }
  });

  it("fills a shop's own wording", () => {
    const out = fillTemplate("Namaste {party}! {business} says: please pay {balance}. {link}", "en", sample);
    expect(out).toBe("Namaste Ravi! Sri Tea says: please pay ₹987.65. https://x.test/s/abc");
  });

  it("refuses wording that would not work", () => {
    expect(checkTemplate("short")).toMatch(/few more words/);
    expect(checkTemplate("Hello {name}, pay here {link}")).toMatch(/not a known placeholder/);
    expect(checkTemplate("Hello {party}, please pay what you owe.")).toMatch(/Include \{link\}/);
    expect(checkTemplate("x".repeat(901) + " {link}")).toMatch(/900/);
    expect(checkTemplate("Hello {party}, {balanceText}. Pay: {link}")).toBeNull();
  });
});
