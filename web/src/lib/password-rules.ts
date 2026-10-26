// Password rules, shared by the forms (for hints) and the server (to enforce them).

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// The most used passwords, plus ones people pick for a shop app. Anything here is refused outright.
const COMMON = new Set([
  "password", "password1", "password123", "passw0rd", "12345678", "123456789", "1234567890", "11111111", "00000000", "87654321",
  "qwerty123", "qwertyuiop", "1q2w3e4r", "1qaz2wsx", "iloveyou", "welcome1", "welcome123", "admin123", "letmein1", "abc12345",
  "abcd1234", "india123", "india@123", "bharat123", "finops123", "finops@123", "onebridge", "shop1234", "business1", "kirana123",
]);

/** Why a new password is not good enough, or null when it is fine. */
export function passwordProblem(password: string, email?: string | null): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return "That password is too common. Choose another.";
  if (/^(.)\1+$/.test(password)) return "Don't use one character repeated.";
  if (/^\d+$/.test(password) && password.length < 12) return "Add some letters, or use 12 or more digits.";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Don't use your email name in the password.";
  return null;
}
