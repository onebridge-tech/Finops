import type { Permission } from "./roles";

// Everything reachable from the "More" page. Add new screens here.
export type MenuItem = { href: string; icon: string; label: string; about: string; permission?: Permission; group: "Sell" | "Money" | "Stock" | "Field" | "Business" };

export const MENU: MenuItem[] = [
  { href: "/quotes", icon: "📝", label: "Quotations", about: "Send prices, get them accepted", group: "Sell" },
  { href: "/orders", icon: "📋", label: "Orders", about: "Sales and purchase orders, partial delivery", group: "Sell" },
  { href: "/notes", icon: "↩️", label: "Credit & debit notes", about: "Returns and corrections linked to invoices", group: "Sell" },
  { href: "/items", icon: "📦", label: "Items", about: "Products, prices, variants", group: "Stock" },
  { href: "/stock", icon: "🏷️", label: "Stock", about: "Levels, adjustments, low-stock alerts", group: "Stock" },
  { href: "/price-lists", icon: "💲", label: "Price lists", about: "Dealer, distributor and party rates", group: "Stock" },
  { href: "/expenses", icon: "🧾", label: "Expenses", about: "Rent, transport, salaries…", group: "Money", permission: "ledger:write" },
  { href: "/cashbook", icon: "💵", label: "Cashbook", about: "Daily cash in and out, day close", group: "Money", permission: "ledger:write" },
  { href: "/shared", icon: "🤝", label: "Shared ledgers", about: "Entries from businesses you trade with, balance checks", group: "Money", permission: "ledger:write" },
  { href: "/reports", icon: "📊", label: "Reports", about: "Ageing, daybook, top lists, sales and expense analysis", group: "Money", permission: "reports:view" },
  { href: "/field", icon: "🚶", label: "Field sales", about: "Visits, beats, targets, attendance", group: "Field" },
  { href: "/data", icon: "⬇️", label: "Import & export", about: "Excel, CSV, backups", group: "Business", permission: "reports:view" },
  { href: "/settings", icon: "⚙️", label: "Settings", about: "Business, team, branches, messaging", group: "Business" },
];
