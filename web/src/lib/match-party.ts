// Guessing which customer a bank statement line belongs to, from the name on the line. Pure, so it is unit-tested.

const NOISE = new Set(["store", "stores", "traders", "trader", "trading", "general", "and", "co", "company", "enterprises", "enterprise", "pvt", "ltd", "private", "limited", "shop", "mart", "the", "sri", "shri", "m", "s", "upi", "neft", "imps", "rtgs", "to", "from", "by", "payment", "pay", "ref"]);

/** Lower-case words of a name, without punctuation, numbers, UPI handles or filler words like "store" and "traders". */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\b[\w.-]+@[a-z]+\b/g, " ") // ravi@okaxis
    .replace(/[^a-z\u0900-\u0dff\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t));
}

/** 0 to 1: how much of the shorter name is found in the longer one. */
export function nameScore(a: string, b: string): number {
  const x = nameTokens(a), y = nameTokens(b);
  if (x.length === 0 || y.length === 0) return 0;
  const [small, big] = x.length <= y.length ? [x, y] : [y, x];
  const hits = small.filter((t) => big.some((u) => u === t || (t.length >= 4 && u.length >= 4 && (u.startsWith(t) || t.startsWith(u))))).length;
  return hits / small.length;
}

/** The customer that best matches the name on a statement line, if any is a clear match. */
export function suggestParty<T extends { id: string; name: string }>(counterparty: string | null, parties: T[], min = 0.67): T | null {
  if (!counterparty) return null;
  let best: T | null = null;
  let bestScore = 0;
  let tie = false;
  for (const p of parties) {
    const s = nameScore(counterparty, p.name);
    if (s > bestScore) { best = p; bestScore = s; tie = false; }
    else if (s === bestScore && s > 0) tie = true;
  }
  return best && bestScore >= min && !tie ? best : null;
}
