/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeAll, describe, expect, it, vi } from "vitest";

// A cookie jar and request headers for the server actions, and redirects that throw so we can see them.
const jar = new Map<string, string>();
const req = { ip: "10.0.0.1" };
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined), set: (k: string, v: string) => jar.set(k, v), delete: (k: string) => jar.delete(k) }),
  headers: async () => new Headers({ "cf-connecting-ip": req.ip, "user-agent": "vitest" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`REDIRECT ${to}`); }, notFound: () => { throw new Error("NOTFOUND"); }, forbidden: () => { throw new Error("FORBIDDEN"); } }));

import { db } from "../src/lib/db";
import { register, resetPassword, signIn } from "../src/app/actions/auth";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };
const email = `owner${Date.now()}@shop.test`;
const good = { name: "Ravi Kumar", email, mobile: "98480 12345", password: "tea at the counter 42", confirm: "tea at the counter 42", terms: "on" };
const redirectOf = async (p: Promise<unknown>) => { try { await p; return null; } catch (e) { return String((e as Error).message); } };

beforeAll(() => { process.env.OTP_DEV_MODE = "1"; process.env.SESSION_SECRET ??= "integration-test-secret-123456"; });

describe("email + password accounts", () => {
  it("checks the registration form", async () => {
    req.ip = "10.0.1.1";
    expect((await register({ step: "form" }, fd({ ...good, password: "short", confirm: "short" }))).error).toMatch(/at least 8/);
    expect((await register({ step: "form" }, fd({ ...good, confirm: "something else 1" }))).error).toMatch(/don't match/);
    expect((await register({ step: "form" }, fd({ ...good, terms: "" }))).error).toMatch(/Terms/);
    expect((await register({ step: "form" }, fd({ ...good, mobile: "123" }))).error).toMatch(/mobile/);
  });

  it("creates the account only after the emailed code is entered", async () => {
    req.ip = "10.0.1.2";
    const s = await register({ step: "form" }, fd(good));
    expect(s).toMatchObject({ step: "verify", email });
    expect(s.devCode).toMatch(/^\d{6}$/);
    const pending = await db.user.findFirstOrThrow({ where: { email } });
    expect(pending.emailVerifiedAt).toBeNull();
    expect(pending.mobile).toBe("919848012345");
    expect(pending.passwordHash).toMatch(/^scrypt\$/);

    // Can't sign in before verifying.
    expect((await signIn({}, fd({ email, password: good.password }))).error).toMatch(/finish creating/);

    const wrong = s.devCode === "000000" ? "111111" : "000000";
    expect((await register(s, fd({ code: wrong }))).error).toMatch(/not right/);
    expect(await redirectOf(register(s, fd({ code: s.devCode! })))).toBe("REDIRECT /onboarding");
    expect((await db.user.findFirstOrThrow({ where: { email } })).emailVerifiedAt).not.toBeNull();
    expect(jar.get("sid")).toBeTruthy();
  });

  it("signs in with the right password only", async () => {
    req.ip = "10.0.1.3";
    expect((await signIn({}, fd({ email, password: "wrong password 1" }))).error).toMatch(/don't match/);
    expect((await signIn({}, fd({ email: "nobody@shop.test", password: "wrong password 1" }))).error).toMatch(/don't match/); // same answer: no hint the address exists
    expect(await redirectOf(signIn({}, fd({ email: email.toUpperCase(), password: good.password })))).toBe("REDIRECT /onboarding");
  });

  it("stops guessing after 5 wrong passwords, even when the next one is right", async () => {
    req.ip = "10.0.1.4";
    for (let i = 0; i < 5; i++) expect((await signIn({}, fd({ email, password: `guess number ${i}` }))).error).toMatch(/don't match/);
    expect((await signIn({}, fd({ email, password: good.password }))).error).toMatch(/Too many tries/);
  });

  it("does not reveal that an address is already registered", async () => {
    req.ip = "10.0.1.5";
    const before = (await db.user.findFirstOrThrow({ where: { email } })).passwordHash;
    const s = await register({ step: "form" }, fd({ ...good, password: "attacker password 9", confirm: "attacker password 9" }));
    expect(s).toMatchObject({ step: "verify", email });
    expect(s.devCode).toBeUndefined();
    expect((await db.user.findFirstOrThrow({ where: { email } })).passwordHash).toBe(before);
  });

  it("resets a forgotten password with an emailed code and signs other devices out", async () => {
    req.ip = "10.0.1.6";
    const unknown = await resetPassword({ step: "email" }, fd({ email: "nobody@shop.test" }));
    expect(unknown).toMatchObject({ step: "verify", devCode: undefined });
    const s = await resetPassword({ step: "email" }, fd({ email }));
    expect(s.info).toBe(unknown.info?.replace("nobody@shop.test", email));
    expect(s.devCode).toMatch(/^\d{6}$/);
    expect((await resetPassword(s, fd({ code: s.devCode!, password: "short", confirm: "short" }))).error).toMatch(/at least 8/);
    const user = await db.user.findFirstOrThrow({ where: { email } });
    const openBefore = await db.session.count({ where: { userId: user.id, revokedAt: null } });
    expect(openBefore).toBeGreaterThan(0);
    expect(await redirectOf(resetPassword(s, fd({ code: s.devCode!, password: "new counter password 7", confirm: "new counter password 7" })))).toBe("REDIRECT /onboarding");
    expect(await db.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(1); // only the new one
    // A used code doesn't work twice.
    expect((await resetPassword(s, fd({ code: s.devCode!, password: "another password 8", confirm: "another password 8" }))).error).toMatch(/expired/);

    req.ip = "10.0.1.7";
    expect((await signIn({}, fd({ email, password: good.password }))).error).toMatch(/don't match/);
    expect(await redirectOf(signIn({}, fd({ email, password: "new counter password 7" })))).toBe("REDIRECT /onboarding");
  });
});
