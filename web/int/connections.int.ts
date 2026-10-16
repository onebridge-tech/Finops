import { afterAll, describe, expect, it } from "vitest";
import { db } from "../src/lib/db";
import { applyConnections, connectionStates, saveConnection } from "../src/lib/integrations";
import { aiConfig } from "../src/lib/note-ai-providers";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

afterAll(async () => { await db.siteSetting.deleteMany({ where: { key: { startsWith: "int:" } } }); await applyConnections(); });

describe("connections set by the platform admin", () => {
  it("stores keys encrypted, applies them, keeps a blank key, and restores the server's value when cleared", async () => {
    process.env.SESSION_SECRET = "a-test-session-secret-a-test-session-secret";
    process.env.GEMINI_API_KEY = "server-key-from-env";
    expect((await saveConnection("ai", fd({ NOTE_AI_PROVIDER: "gemini", GEMINI_API_KEY: "admin-key-123456" }), "admin1"))).toMatchObject({ ok: true });
    expect(process.env.GEMINI_API_KEY).toBe("admin-key-123456");
    expect(aiConfig(process.env)).toMatchObject({ provider: "gemini", key: "admin-key-123456" });
    const row = await db.siteSetting.findUniqueOrThrow({ where: { key: "int:GEMINI_API_KEY" } });
    expect(row.value).not.toContain("admin-key");
    expect(row.value.startsWith("enc1:")).toBe(true);
    // the provider choice is plain text, not a secret
    expect((await db.siteSetting.findUniqueOrThrow({ where: { key: "int:NOTE_AI_PROVIDER" } })).value).toBe("gemini");

    let ai = (await connectionStates()).list.find((i) => i.id === "ai")!;
    expect(ai.status).toBe("connected");
    expect(ai.fields.find((f) => f.env === "GEMINI_API_KEY")).toMatchObject({ source: "admin", shown: "••••3456" });

    // saving again with the key box empty keeps the key
    await saveConnection("ai", fd({ NOTE_AI_PROVIDER: "gemini", GEMINI_API_KEY: "", NOTE_AI_MODEL: "gemini-2.5-pro" }), "admin1");
    expect(process.env.GEMINI_API_KEY).toBe("admin-key-123456");
    expect(process.env.NOTE_AI_MODEL).toBe("gemini-2.5-pro");

    // clearing the key brings back the server's own value
    await saveConnection("ai", fd({ NOTE_AI_PROVIDER: "gemini", clear_GEMINI_API_KEY: "on" }), "admin1");
    expect(process.env.GEMINI_API_KEY).toBe("server-key-from-env");
    ai = (await connectionStates()).list.find((i) => i.id === "ai")!;
    expect(ai.fields.find((f) => f.env === "GEMINI_API_KEY")?.source).toBe("server");
  });

  it("rejects values that are not safe", async () => {
    expect((await saveConnection("ai", fd({ NOTE_AI_PROVIDER: "evil" }), "a"))).toMatchObject({ ok: false });
    expect((await saveConnection("ai", fd({ NOTE_AI_PROVIDER: "custom", NOTE_AI_BASE_URL: "http://insecure.test" }), "a"))).toMatchObject({ ok: false });
    expect((await saveConnection("nope", fd({}), "a"))).toMatchObject({ ok: false });
  });

  it("reports values that were saved under a different server secret", async () => {
    process.env.SESSION_SECRET = "first-secret-first-secret-first-secret";
    await saveConnection("google", fd({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "shh-shh-shh" }), "a");
    process.env.SESSION_SECRET = "second-secret-second-secret-second";
    const s = await connectionStates();
    expect(s.unreadable).toContain("GOOGLE_CLIENT_SECRET");
  });
});
