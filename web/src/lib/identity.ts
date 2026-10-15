// People can sign in with a phone number, an email address or Google, so a name or contact
// can no longer assume a phone number exists.

type Who = { name?: string | null; phone?: string | null; email?: string | null };

/** Name if known, otherwise the contact they signed up with. */
export function userLabel(u: Who | null | undefined): string {
  if (!u) return "Former member";
  return u.name || (u.phone ? `+${u.phone}` : u.email) || "Unknown";
}

/** The contact line shown under a name. */
export function userContact(u: Who): string {
  return [u.phone ? `+${u.phone}` : null, u.email].filter(Boolean).join(" · ") || "—";
}

export const normalizeEmail = (v: string): string | null => {
  const e = v.trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
};
