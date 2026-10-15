import type { Permission } from "./roles";

// Everything reachable from the "More" page. Add new screens here.
export type MenuItem = { href: string; icon: string; label: string; about: string; permission?: Permission; group: "Sell" | "Money" | "Stock" | "Field" | "Business" };

export const MENU: MenuItem[] = [
  { href: "/outbox", icon: "send", label: "WhatsApp outbox", about: "Messages ready to send from your own WhatsApp", group: "Sell", permission: "reminder:send" },
  { href: "/quotes", icon: "note", label: "Price quotes", about: "Send a price, get a yes", group: "Sell" },
  { href: "/orders", icon: "cart", label: "Orders", about: "What customers ordered, and what you ordered", group: "Sell" },
  { href: "/notes", icon: "undo", label: "Returns", about: "Goods sent back, or a bill that needs fixing", group: "Sell" },
  { href: "/items", icon: "box", label: "Your items", about: "What you sell, and the price", group: "Stock" },
  { href: "/stock", icon: "tag", label: "Stock", about: "How much is left, and what to buy soon", group: "Stock" },
  { href: "/price-lists", icon: "tag", label: "Special prices", about: "A different rate for dealers or regular customers", group: "Stock" },
  { href: "/money", icon: "trend", label: "Money in & out", about: "Add your bank statement and see what you earned and spent", group: "Money", permission: "reports:view" },
  { href: "/money/profit", icon: "chart", label: "Profit & loss", about: "What you made after costs, month by month", group: "Money", permission: "reports:view" },
  { href: "/expenses", icon: "bill", label: "Shop expenses", about: "Rent, transport, salaries, tea and snacks", group: "Money", permission: "ledger:write" },
  { href: "/cashbook", icon: "wallet", label: "Cash in the drawer", about: "Today’s cash in and out, and closing the day", group: "Money", permission: "ledger:write" },
  { href: "/payments", icon: "card", label: "Money paid online", about: "Payments customers made from your link", group: "Money", permission: "reports:view" },
  { href: "/shared", icon: "handshake", label: "Match accounts", about: "Check that your account and your customer’s account agree", group: "Money", permission: "ledger:write" },
  { href: "/reports", icon: "chart", label: "Reports", about: "Who owes most, daily book, best sellers", group: "Money", permission: "reports:view" },
  { href: "/field", icon: "walk", label: "Salesmen on the road", about: "Visits, daily routes, targets, attendance", group: "Field" },
  { href: "/data", icon: "download", label: "Excel & backup", about: "Bring in your old list, or download everything", group: "Business", permission: "reports:view" },
  { href: "/settings/tally", icon: "link", label: "Connect to Tally", about: "Send your bills to your accountant’s Tally", group: "Business", permission: "settings:write" },
  { href: "/settings/team", icon: "users", label: "Staff & access", about: "Add your people and choose what each one can see and do", group: "Business", permission: "team:manage" },
  { href: "/settings/branches", icon: "shop", label: "Shop branches", about: "More than one shop or godown? Keep each one’s bills separate", group: "Business", permission: "settings:write" },
  { href: "/settings/security", icon: "lock", label: "Security & sign-in", about: "Your PIN lock, how you sign in, language and signing out devices", group: "Business" },
  { href: "/settings/audit", icon: "clock", label: "Who changed what", about: "A record of every change, with who did it and when", group: "Business", permission: "reports:view" },
  { href: "/settings/templates", icon: "note", label: "Message wording", about: "Change the words your customers get on WhatsApp", group: "Business", permission: "settings:write" },
  { href: "/settings/credits", icon: "card", label: "Message credits", about: "SMS costs one credit each. WhatsApp is free", group: "Business", permission: "settings:write" },
  { href: "/settings/standee", icon: "download", label: "Counter QR", about: "Print a stand with your UPI QR for the counter", group: "Business", permission: "settings:write" },
  { href: "/settings", icon: "sliders", label: "Settings", about: "Shop details, bill look, credit limits and reminders", group: "Business" },
  { href: "/help", icon: "help", label: "Help & guide", about: "What every screen is for, in simple words", group: "Business" },
];
