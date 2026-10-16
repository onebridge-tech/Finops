import type { IconName } from "@/components/icon";

// One place that explains every screen in two or three plain lines. The same text shows under each page
// title ("What is this?") and in the Help & guide page, so they can never disagree.

export type HelpGroup = "Every day" | "Selling" | "Items & stock" | "Money" | "People on the road" | "Your shop & safety";

export type Help = {
  /** The address, with [id] standing for any id. */
  path: string;
  title: string;
  icon: IconName;
  group: HelpGroup;
  text: string;
  /** Show on the Help & guide page (the main screens), not the small steps inside them. */
  guide?: boolean;
};

export const HELP: Help[] = [
  // Every day
  { path: "/dashboard", title: "Home", icon: "home", group: "Every day", guide: true, text: "Your shop at a glance: money to get, money to give, what you received today and who is late. The big buttons write credit or a payment, make a bill or ask for money. “Choose cards” lets you pick what to show." },
  { path: "/parties", title: "Customers & suppliers", icon: "users", group: "Every day", guide: true, text: "Everyone you sell to or buy from, with what they owe you or what you owe them. Tap a name to open their full account, write credit or payment, and send a reminder." },
  { path: "/parties/new", title: "Add a customer or supplier", icon: "users", group: "Every day", text: "Only the name is needed. Add a mobile number to send WhatsApp reminders, and “days to pay” so we know when their money is due. If they already owed you before you started, put that in “already pending”." },
  { path: "/parties/[id]", title: "A customer’s account", icon: "users", group: "Every day", text: "Everything with this person: what they owe, every entry, bills and messages. Use “Write an entry” for goods given on credit or a payment received. Undo removes a wrong entry without erasing it." },
  { path: "/parties/[id]/edit", title: "Change a customer’s details", icon: "users", group: "Every day", text: "Fix the name, number, credit limit or days to pay. The credit limit warns you, or stops you, when a customer’s pending amount would go above it." },
  { path: "/collections", title: "Get your money", icon: "rupee", group: "Every day", guide: true, text: "Shows who is late and by how many days, so you know who to ask first. Tick customers and send many reminders at once. WhatsApp reminders go to your outbox and you tap Send on each." },
  { path: "/follow-ups", title: "Calls to make", icon: "phone", group: "Every day", guide: true, text: "Your to-do list of calls and visits: money to ask for and people who may become customers. Add a call from a customer’s page, call from here, and tick it done with what happened." },
  { path: "/outbox", title: "WhatsApp outbox", icon: "send", group: "Every day", guide: true, text: "Reminders, receipts and bills written for you from your templates. Tap Send, WhatsApp opens with the words ready, and you press send there. Nothing goes out until you tap, and it costs nothing." },
  { path: "/search", title: "Search", icon: "search", group: "Every day", guide: true, text: "Find anything by name, phone number, bill number, item or amount. Press Ctrl and K anywhere to jump to a screen quickly." },
  { path: "/more", title: "Everything else", icon: "grid", group: "Every day", text: "All the other parts of the app, grouped by what they do. Tap one to open it." },

  // Selling
  { path: "/invoices", title: "Bills", icon: "bill", group: "Selling", guide: true, text: "Your GST bills. Each shows who it is for, the amount and whether it is paid. Make a new bill, share it on WhatsApp, or let the customer pay online from the link." },
  { path: "/invoices/new", title: "Make a bill", icon: "bill", group: "Selling", text: "Pick the customer, add items and quantities, and the GST is worked out for you. If the customer is in another state it becomes IGST. The bill number comes by itself." },
  { path: "/invoices/[id]", title: "A bill", icon: "bill", group: "Selling", text: "Share it on WhatsApp, print it, or send it by SMS or email. “Return note” records goods sent back. “Cancel this bill” takes it off the customer’s account, so use it only before you file GST." },
  { path: "/quotes", title: "Price quotes", icon: "note", group: "Selling", guide: true, text: "Send a price before the customer buys. When they say yes, mark it accepted and turn it into a bill or an order in one tap." },
  { path: "/quotes/new", title: "New price quote", icon: "note", group: "Selling", text: "Same as a bill, but nothing is added to the customer’s account until it becomes a bill. “Valid until” is how long the price holds." },
  { path: "/quotes/[id]", title: "A price quote", icon: "note", group: "Selling", text: "Share it, then mark it accepted or declined. “Make this a bill” or “Make an order” carries every item across." },
  { path: "/orders", title: "Orders", icon: "cart", group: "Selling", guide: true, text: "What customers ordered from you, and what you ordered from suppliers. You can deliver part of an order now and the rest later; each delivery makes its own bill." },
  { path: "/orders/new", title: "New order", icon: "cart", group: "Selling", text: "Write down what was ordered and when it is expected. Nothing is billed or taken out of stock until you deliver." },
  { path: "/orders/[id]", title: "An order", icon: "cart", group: "Selling", text: "Enter what you are delivering now. A bill is made for just those quantities and the rest stays pending. For a supplier order, receiving adds to your stock." },
  { path: "/notes", title: "Returns & corrections", icon: "undo", group: "Selling", guide: true, text: "A return note lowers what a customer owes when goods come back or you give a discount. An extra charge note adds to it. Both are tied to the bill they correct." },
  { path: "/notes/new", title: "New note", icon: "undo", group: "Selling", text: "Pick the bill, choose how much of each item came back, and say why. Tick “back to stock” if the goods return to your shelf." },
  { path: "/notes/[id]", title: "A return or extra charge note", icon: "undo", group: "Selling", text: "A paper that shows what was changed on a bill and why. Print or share it with the customer." },
  { path: "/price-lists", title: "Special prices", icon: "tag", group: "Selling", guide: true, text: "A different rate for dealers or regular customers, even by quantity (for example a lower rate from 50 pieces). Attach a list to a customer and bills use it by themselves." },
  { path: "/price-lists/[id]", title: "A special price list", icon: "tag", group: "Selling", text: "Add the items and the rate each customer on this list pays. “From quantity” sets a slab: 0 means any quantity, 50 means the rate applies from 50 upward." },

  // Items & stock
  { path: "/items", title: "Your items", icon: "box", group: "Items & stock", guide: true, text: "What you sell, with its price and GST rate. Add an item once, then pick it when you make a bill. Add a buying price to see your profit, and tick “Track stock” to count what is left." },
  { path: "/items/[id]", title: "Change an item", icon: "box", group: "Items & stock", text: "Update the price, GST rate or stock settings. Old bills keep the price they were made with." },
  { path: "/stock", title: "Stock", icon: "box", group: "Items & stock", guide: true, text: "How much of each tracked item is left. Selling reduces it, receiving from a supplier adds to it. Use “Adjust stock” after counting, if something is damaged or you find extra." },

  // Money
  { path: "/money", title: "Money in & out", icon: "trend", group: "Money", guide: true, text: "Add your bank statement to see how much you earned and spent each month, and on what. Fix any group we guessed wrong and the app remembers. Cash taken out and your own use are not counted as spending." },
  { path: "/money/import", title: "Add a statement", icon: "download", group: "Money", text: "Download your statement from the bank as Excel or CSV and add it here. We find the columns and show a preview before anything is saved. Lines already added before are skipped, never counted twice." },
  { path: "/money/profit", title: "Profit & loss", icon: "chart", group: "Money", guide: true, text: "What you made after costs, month by month: sales before GST, minus the cost of what you sold, minus shop expenses. It is a quick guide, not a statement for tax." },
  { path: "/expenses", title: "Shop expenses", icon: "wallet", group: "Money", guide: true, text: "Write down what the shop spends: rent, salaries, transport, tea. Expenses reduce your profit and show in reports. Add a receipt photo if you want to keep it." },
  { path: "/cashbook", title: "Cash in the drawer", icon: "wallet", group: "Money", guide: true, text: "Today’s cash in and out, built from cash payments and cash expenses. At night, count the drawer and press “Close today”; any difference is noted so you can see if cash went missing." },
  { path: "/purchases", title: "Purchase bills", icon: "box", group: "Money", guide: true, text: "Write down the bills your suppliers give you. The GST on them can be claimed back against the GST you collect, so your tax to pay becomes smaller. Bills without a supplier GSTIN cannot be claimed." },
  { path: "/reports/gst", title: "GST returns", icon: "bill", group: "Money", guide: true, text: "Your GST for one month, worked out from your bills, return notes and supplier bills: the GSTR-1 sections, the GSTR-3B summary and the tax to pay. Download Excel for your accountant, or the GSTR-1 file to upload on the GST portal." },
  { path: "/reports/year-end", title: "Year-end pack & tax estimate", icon: "chart", group: "Money", guide: true, text: "One Excel file with the whole financial year: sales, purchases, expenses, payments, balances, bank lines, monthly profit and GST. It also gives a rough income tax estimate. Give it to your accountant; it is a starting point, not tax advice." },
  { path: "/payments", title: "Money paid online", icon: "card", group: "Money", guide: true, text: "Payments customers made from the “Pay online” button on your bill or account link. Each one is already written in their account with a receipt, and the bill is marked paid." },
  { path: "/shared", title: "Match accounts", icon: "handshake", group: "Money", guide: true, text: "If a customer or supplier also uses this app, you can both see the same entries and check that your balances agree. Entries they make appear here for you to accept." },
  { path: "/reports", title: "Reports", icon: "chart", group: "Money", guide: true, text: "Who owes you and for how long, a daily book of everything, best customers and items, sales and expense breakdowns. Every report can be downloaded to Excel or printed." },
  { path: "/reports/[kind]", title: "A report", icon: "chart", group: "Money", text: "Choose the period at the top and press Show. Use Excel or CSV to download it, or Print to save a PDF." },

  // People on the road
  { path: "/field", title: "Salesmen on the road", icon: "walk", group: "People on the road", guide: true, text: "For people who visit customers. They start their day, check in at each customer, take an order, collect money and check out. It works without signal and uploads when they are back online." },
  { path: "/field/beats", title: "Daily routes", icon: "walk", group: "People on the road", guide: true, text: "A route is the list of customers a salesman visits on certain days, in order. Today’s route shows on their screen, and customers they miss appear in the “Missed visits” report." },
  { path: "/field/team", title: "Staff & targets", icon: "users", group: "People on the road", guide: true, text: "Who started work today, who is visiting which customer, and whether anyone checked in far from the customer’s shop. Set monthly targets and see who is behind." },

  // Your shop & safety
  { path: "/settings", title: "Settings", icon: "sliders", group: "Your shop & safety", guide: true, text: "Your shop’s details, how bills look, credit limits, messages and reminders, and shortcuts to staff, security and backups. Use the list on the left to jump to a part." },
  { path: "/settings/security", title: "Security & sign-in", icon: "lock", group: "Your shop & safety", guide: true, text: "Choose how you sign in (mobile, email or Google), set a PIN so nobody can open your accounts on an unattended phone, change your language, and sign out other devices." },
  { path: "/settings/team", title: "Staff & access", icon: "users", group: "Your shop & safety", guide: true, text: "Add the people who work with you and choose what each can do. A salesman only sees customers given to him. Remove someone and their phones are signed out at once." },
  { path: "/settings/branches", title: "Shop branches", icon: "shop", group: "Your shop & safety", guide: true, text: "If you have more than one shop or godown, add each as a branch. Bills and entries show which branch made them, and a staff member can be limited to one branch." },
  { path: "/settings/audit", title: "Who changed what", icon: "clock", group: "Your shop & safety", guide: true, text: "A record of every change to your money, customers, items and settings: who did it and when. It cannot be switched off or edited, so nobody can quietly change your books." },
  { path: "/settings/credits", title: "Message credits", icon: "card", group: "Your shop & safety", guide: true, text: "Credits pay for SMS messages: one credit per SMS. WhatsApp from your own phone and email are free. See what was used, by whom, and buy more here." },
  { path: "/settings/templates", title: "Message wording", icon: "note", group: "Your shop & safety", guide: true, text: "The words your customers get on WhatsApp. Change them to sound like you, in each language. Words in curly brackets, like {party} and {link}, are filled in for each customer." },
  { path: "/settings/tally", title: "Connect to Tally", icon: "link", group: "Your shop & safety", guide: true, text: "For shops whose accountant uses Tally. A small program on the Tally computer sends your bills and receipts across, so nobody types them twice. You need a key from this page." },
  { path: "/settings/standee", title: "Counter QR", icon: "download", group: "Your shop & safety", text: "A printable stand with your UPI QR code. Keep it on the counter so customers can pay in any UPI app." },
  { path: "/data", title: "Excel & backup", icon: "download", group: "Your shop & safety", guide: true, text: "Bring your old customer and item list in from Excel, download any list, or download everything as one file. Keep a copy somewhere safe." },
];

const toRegex = (p: string) => new RegExp("^" + p.replace(/\[[^\]]+\]/g, "[^/]+").replace(/\//g, "\\/") + "\\/?$");
const compiled = HELP.map((h) => ({ h, re: toRegex(h.path) }));

/** The explanation for a page address, or null. Exact matches win over patterns with an id in them. */
export function helpFor(pathname: string): Help | null {
  const path = pathname.split("?")[0] ?? pathname;
  return compiled.find((c) => c.h.path === path)?.h ?? compiled.find((c) => c.re.test(path))?.h ?? null;
}

export const GUIDE_GROUPS: HelpGroup[] = ["Every day", "Selling", "Items & stock", "Money", "People on the road", "Your shop & safety"];
