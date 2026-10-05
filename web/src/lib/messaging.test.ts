import { describe, expect, it } from "vitest";
import { ageing, openDues } from "./ledger";
import { effectiveRule, reminderReason, type ReminderRule } from "./reminder-rule";
import { renderMessage, templateParams } from "./messaging/templates";

// Noon IST on a calendar day, the way ledger dates are stored.
const day = (s: string) => new Date(`${s}T12:00:00+05:30`);
const due = (s: string) => new Date(`${s}T23:59:59+05:30`);

describe("open dues and ageing", () => {
  const entries = [
    { id: "a", direction: "GAVE", amountPaise: 100000n, date: day("2026-06-01"), dueDate: due("2026-06-15") },
    { id: "b", direction: "GAVE", amountPaise: 50000n, date: day("2026-08-20"), dueDate: due("2026-09-04") },
    { id: "c", direction: "GOT", amountPaise: 30000n, date: day("2026-09-01") },
    { id: "d", direction: "GAVE", amountPaise: 20000n, date: day("2026-10-01"), dueDate: due("2026-10-20") },
  ];
  it("settles the oldest dues first", () => {
    expect(openDues(entries).map((d) => [d.id, d.open])).toEqual([["a", 70000], ["b", 50000], ["d", 20000]]);
  });
  it("buckets overdue amounts by days late", () => {
    // On 5 Oct: a is 112 days late, b is 31 days late, d is not due yet.
    expect(ageing(entries, day("2026-10-05"))).toEqual({ "0-30": 0, "31-60": 50000, "61-90": 0, "90+": 70000 });
  });
  it("is not overdue on the due date itself", () => {
    expect(ageing(entries, day("2026-10-20"))["0-30"]).toBe(0);
    expect(ageing(entries, day("2026-10-21"))["0-30"]).toBe(20000);
  });
});

describe("auto-reminder rule", () => {
  const rule: ReminderRule = { daysBefore: 3, onDue: true, everyDaysAfter: 7, channel: "WHATSAPP" };
  const dues = [{ id: "x", date: day("2026-10-01"), due: due("2026-10-20"), open: 5000 }];

  it("fires before, on and after the due date on schedule", () => {
    expect(reminderReason(rule, dues, day("2026-10-17"), null)).toBe("due in 3 days");
    expect(reminderReason(rule, dues, day("2026-10-18"), null)).toBeNull();
    expect(reminderReason(rule, dues, day("2026-10-20"), null)).toBe("due today");
    expect(reminderReason(rule, dues, day("2026-10-27"), null)).toBe("7 days overdue");
    expect(reminderReason(rule, dues, day("2026-11-03"), null)).toBe("14 days overdue");
    expect(reminderReason(rule, dues, day("2026-10-30"), null)).toBeNull();
  });
  it("sends at most once a day", () => {
    expect(reminderReason(rule, dues, day("2026-10-20"), new Date("2026-10-20T04:00:00Z"))).toBeNull();
    expect(reminderReason(rule, dues, day("2026-10-20"), new Date("2026-10-19T04:00:00Z"))).toBe("due today");
  });
  it("lets a party override or switch off the business rule", () => {
    const business = { reminderEnabled: true, reminderDaysBefore: 3, reminderOnDue: true, reminderEveryDaysAfter: 7, reminderChannel: "WHATSAPP" };
    const none = { reminderDaysBefore: null, reminderOnDue: null, reminderEveryDaysAfter: null, reminderChannel: null };
    expect(effectiveRule(business, { ...none, reminderMode: "DEFAULT" })?.daysBefore).toBe(3);
    expect(effectiveRule(business, { ...none, reminderMode: "OFF" })).toBeNull();
    expect(effectiveRule({ ...business, reminderEnabled: false }, { ...none, reminderMode: "DEFAULT" })).toBeNull();
    const custom = effectiveRule({ ...business, reminderEnabled: false }, { ...none, reminderMode: "CUSTOM", reminderEveryDaysAfter: 2, reminderChannel: "SMS" });
    expect(custom).toEqual({ daysBefore: null, onDue: false, everyDaysAfter: 2, channel: "SMS" });
  });
});

describe("message templates", () => {
  const v = { party: "Lakshmi Stores", business: "Sri Sai Traders", link: "https://x/s/abc", balancePaise: 680000 };
  it("renders in the party's language with an opt-out link", () => {
    expect(renderMessage("REMINDER", "en", v, "https://x/o/abc")).toBe(
      "Hello Lakshmi Stores, a friendly reminder from Sri Sai Traders: ₹6,800.00 is due. View your statement and pay here: https://x/s/abc\nStop messages: https://x/o/abc",
    );
    expect(renderMessage("REMINDER", "hi", v)).toContain("₹6,800.00 बकाया है");
    expect(renderMessage("REMINDER", "xx", v)).toContain("friendly reminder"); // unknown language falls back to English
  });
  it("describes the balance from the party's side", () => {
    const r = (b: number) => renderMessage("STATEMENT", "en", { ...v, balancePaise: b });
    expect(r(500)).toContain("₹5.00 due");
    expect(r(-500)).toContain("₹5.00 in your favour");
    expect(r(0)).toContain("settled");
  });
  it("lists provider template parameters in order", () => {
    expect(templateParams("RECEIPT", { ...v, amountPaise: 1200, date: "05 Oct 2026", number: "RCPT-1" }))
      .toEqual(["Lakshmi Stores", "Sri Sai Traders", "₹12.00", "05 Oct 2026", "RCPT-1", "https://x/s/abc"]);
  });
});
