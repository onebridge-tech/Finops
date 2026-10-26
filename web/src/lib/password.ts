import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

export { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from "./password-rules";

// Passwords are stored as scrypt hashes with a random salt per password, in the form
//   scrypt$<N>$<r>$<p>$<salt>$<hash>
// so the cost can be raised later without breaking older hashes.

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const N = 2 ** 15, R = 8, P = 1, LEN = 64;
const opts = (n: number, r: number, p: number) => ({ N: n, r, p, maxmem: 128 * n * r * 2 });

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, LEN, opts(N, R, P));
  return ["scrypt", N, R, P, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  // With no stored hash we still do the work, so a wrong email takes as long as a wrong password.
  const [kind, n, r, p, salt, hash] = (stored ?? DUMMY).split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64url");
  const got = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64url"), want.length, opts(Number(n), Number(r), Number(p)));
  return !!stored && got.length === want.length && timingSafeEqual(got, want);
}
const DUMMY = `scrypt$${N}$${R}$${P}$AAAAAAAAAAAAAAAAAAAAAA$${"A".repeat(86)}`;
