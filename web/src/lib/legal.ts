// Facts used by every legal page. Fill in the values marked TODO before the site goes live; each one shows up
// in the Terms, Privacy Policy and Grievance pages exactly as written here.
export const LEGAL = {
  /** Date these documents were last changed. Update it whenever the text changes. */
  UPDATED: "16 October 2026",
  SITE: "https://finops.onebridgeinfotech.com",
  /** The company that runs FinOps. TODO: replace with the exact registered name. */
  COMPANY: "OneBridge Infotech",
  /** TODO: registered office address as it appears on the company registration. */
  ADDRESS: "[Registered office address to be added]",
  /** TODO: a mailbox that is checked every working day. */
  SUPPORT_EMAIL: "support@onebridgeinfotech.com",
  PRIVACY_EMAIL: "privacy@onebridgeinfotech.com",
  /** TODO: name and designation of the Grievance Officer (IT Rules 2021, DPDP Act 2023). */
  GRIEVANCE_OFFICER: "[Name, Grievance Officer — to be added]",
  GRIEVANCE_EMAIL: "grievance@onebridgeinfotech.com",
  /** TODO: city whose courts decide disputes. */
  COURT_CITY: "[City to be added]",
  /** Days we take to answer a complaint. */
  REPLY_DAYS: 15,
  /** Days a deleted shop stays recoverable before everything is erased. */
  DELETE_GRACE_DAYS: 30,
} as const;

export const LEGAL_PAGES = [
  { href: "/terms", label: "Terms of Use" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refunds & Cancellation" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/cookies", label: "Cookies" },
  { href: "/grievance", label: "Contact & Grievance" },
] as const;
