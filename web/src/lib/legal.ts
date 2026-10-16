// Facts that do not change per company. Company details (name, address, mailboxes, grievance officer) are filled in by a
// platform admin under Platform admin > Company info and read through getSite() in lib/site-settings.ts.
export const LEGAL = {
  /** Date these documents were last changed. Update it whenever the text changes. */
  UPDATED: "16 October 2026",
  SITE: "https://finops.onebridgeinfotech.com",
} as const;

export const LEGAL_PAGES = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refunds & Cancellation" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/cookies", label: "Cookies" },
  { href: "/grievance", label: "Contact & Grievance" },
] as const;
