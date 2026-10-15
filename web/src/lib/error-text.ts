import { createHash } from "node:crypto";

// Pure helpers for turning an error into something safe to keep and easy to group.

/** Takes personal details and ids out of a message so identical problems group together and nothing private is stored. */
export function scrub(message: string): string {
  return message
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/\b\d{8,}\b/g, "<number>")
    .replace(/\b[a-z0-9]{24,}\b/gi, "<id>")
    .slice(0, 500);
}

export function fingerprint(kind: string, route: string, message: string): string {
  return createHash("sha1").update(`${kind}|${route}|${scrub(message).replace(/\d+/g, "#").slice(0, 200)}`).digest("hex").slice(0, 24);
}

