// Role templates (PRD section 8). Pure so client components can use them too.

export type Role = "OWNER" | "ADMIN" | "ACCOUNTANT" | "BILLING" | "REP" | "VIEWER";

export type Permission =
  | "party:write"
  | "ledger:write"
  | "ledger:reverse"
  | "item:write"
  | "invoice:write"
  | "invoice:cancel"
  | "reminder:send"
  | "reports:view" // business-wide totals, exports
  | "team:manage"
  | "settings:write";

export const ROLES: Role[] = ["OWNER", "ADMIN", "ACCOUNTANT", "BILLING", "REP", "VIEWER"];

export const ROLE_LABEL: Record<Role, { name: string; about: string }> = {
  OWNER: { name: "Owner", about: "Everything, including team, billing and backups" },
  ADMIN: { name: "Admin", about: "Everything except removing the owner" },
  ACCOUNTANT: { name: "Accountant", about: "Ledger, invoices, corrections and reports" },
  BILLING: { name: "Billing staff", about: "Parties, entries, invoices and reminders" },
  REP: { name: "Field rep", about: "Their assigned parties: entries, collections, reminders" },
  VIEWER: { name: "Viewer", about: "Read-only" },
};

const GRANTS: Record<Role, Permission[]> = {
  OWNER: ["party:write", "ledger:write", "ledger:reverse", "item:write", "invoice:write", "invoice:cancel", "reminder:send", "reports:view", "team:manage", "settings:write"],
  ADMIN: ["party:write", "ledger:write", "ledger:reverse", "item:write", "invoice:write", "invoice:cancel", "reminder:send", "reports:view", "team:manage", "settings:write"],
  ACCOUNTANT: ["party:write", "ledger:write", "ledger:reverse", "item:write", "invoice:write", "invoice:cancel", "reminder:send", "reports:view"],
  BILLING: ["party:write", "ledger:write", "invoice:write", "reminder:send"],
  REP: ["party:write", "ledger:write", "reminder:send"],
  VIEWER: [],
};

export function can(role: string, p: Permission): boolean {
  return GRANTS[role as Role]?.includes(p) ?? false;
}
