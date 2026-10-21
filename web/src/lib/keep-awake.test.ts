import { describe, expect, it } from "vitest";
import { keepAwakePlan } from "./keep-awake";

describe("keepAwakePlan", () => {
  it("is on by default on Render, using Render's public address", () => {
    expect(keepAwakePlan({ RENDER: "true", RENDER_EXTERNAL_URL: "https://finops.onrender.com/" })).toEqual({
      url: "https://finops.onrender.com/api/health",
      everyMs: 10 * 60_000,
    });
  });

  it("is off elsewhere unless asked for", () => {
    expect(keepAwakePlan({ APP_URL: "https://finops.onebridgeinfotech.com" })).toBeNull();
    expect(keepAwakePlan({ KEEP_AWAKE: "1", APP_URL: "https://finops.onebridgeinfotech.com" })?.url).toBe("https://finops.onebridgeinfotech.com/api/health");
  });

  it("can be switched off, and never pings localhost", () => {
    expect(keepAwakePlan({ RENDER: "true", KEEP_AWAKE: "0", RENDER_EXTERNAL_URL: "https://a.onrender.com" })).toBeNull();
    expect(keepAwakePlan({ KEEP_AWAKE: "1", APP_URL: "http://localhost:3000" })).toBeNull();
    expect(keepAwakePlan({ KEEP_AWAKE: "1" })).toBeNull();
  });

  it("keeps the interval under Render's 15-minute sleep and can include the database", () => {
    expect(keepAwakePlan({ KEEP_AWAKE: "1", APP_URL: "https://x.in", KEEP_AWAKE_MINUTES: "30" })?.everyMs).toBe(14 * 60_000);
    expect(keepAwakePlan({ KEEP_AWAKE: "1", APP_URL: "https://x.in", KEEP_AWAKE_MINUTES: "0" })?.everyMs).toBe(10 * 60_000);
    expect(keepAwakePlan({ KEEP_AWAKE: "1", APP_URL: "https://x.in", KEEP_AWAKE_DB: "1" })?.url).toBe("https://x.in/api/health?db=1");
  });
});
