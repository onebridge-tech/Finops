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
  { href: "/expenses", icon: "bill", label: "Shop expenses", about: "Rent, transport, salaries, tea and snacks", group: "Money", permission: "ledger:write" },
  { href: "/cashbook", icon: "wallet", label: "Cash in the drawer", about: "Today’s cash in and out, and closing the day", group: "Money", permission: "ledger:write" },
  { href: "/payments", icon: "card", label: "Money paid online", about: "Payments customers made from your link", group: "Money", permission: "reports:view" },
  { href: "/shared", icon: "handshake", label: "Match accounts", about: "Check that your account and your customer’s account agree", group: "Money", permission: "ledger:write" },
  { href: "/reports", icon: "chart", label: "Reports", about: "Who owes most, daily book, best sellers", group: "Money", permission: "reports:view" },
  { href: "/field", icon: "walk", label: "Salesmen on the road", about: "Visits, daily routes, targets, attendance", group: "Field" },
  { href: "/data", icon: "download", label: "Excel & backup", about: "Bring in your old list, or download everything", group: "Business", permission: "reports:view" },
  { href: "/settings/tally", icon: "link", label: "Connect to Tally", about: "Send your bills to your accountant’s Tally", group: "Business", permission: "settings:write" },
  { href: "/settings", icon: "sliders", label: "Settings", about: "Shop details, staff, WhatsApp, UPI", group: "Business" },
];
