# FinOps — manual test checklist

Test site: https://business-ledger-gx5j.onrender.com (free Render plan: the first page after a quiet period takes about a minute to wake up).

**Sign in.** Type a mobile number. The 6-digit code is shown on the screen (test mode, no SMS is sent).
Ready-made test shop "Sri Test Tea Stall": owner **7075196267** (yours), owner **9000000001**, field rep **9000000003**.
Everything WhatsApp / SMS / email / online payment runs in **test mode**: it is recorded and shown as delivered, but nothing leaves the server and no money moves.

Tick each line when the result matches.

## 1. Customers and the account book
- [ ] Add a customer with phone, "days to pay" 15 and a credit limit of 5000. → Customer page opens, limit shows ₹5,000 available.
- [ ] "Gave on credit" ₹3,000. → Total pending ₹3,000, "owes you". Due date = today + 15 days.
- [ ] "Got a payment" ₹1,000 by cash. → Pending ₹2,000, receipt number shown, a receipt message appears under "Messages sent".
- [ ] "Gave on credit" ₹4,000 (over the limit). → A "Credit limit check" warning appears. "Continue anyway" saves it.
- [ ] "Undo" on that entry. → A reversal row appears and the balance goes back.
- [ ] Search for the customer in capitals and in small letters. → Found either way.

## 2. Items, stock, bills
- [ ] Add an item "Tea Powder" ₹400, 5% GST, tick Track stock. Add 20 kg on the Stock page. → 20 kg on hand.
- [ ] Make a bill: 5 kg Tea Powder. → Before GST ₹2,000, CGST ₹50, SGST ₹50, total ₹2,100. Stock becomes 15 kg.
- [ ] Open the customer's public bill link (Copy link). → Bill shows, "Pay ₹2,100 online" button is there.
- [ ] Press Pay, then "Pay (test)". → "Payment received", receipt number, bill shows **Paid**, listed under "Money paid online".
- [ ] A customer in another state (use a GSTIN or change Place of supply). → IGST instead of CGST + SGST.

## 3. Quotes, orders, returns
- [ ] Make a price quote, then "Make an order". → Customer order created from it.
- [ ] Deliver part of the order. → A bill is created for just that quantity; the rest stays pending.
- [ ] On that bill tap "Return note", return 1 unit. → Return note total is correct and the customer's pending amount goes down.

## 4. Money and reports
- [ ] Add a shop expense (cash). → "Cash in the drawer" shows cash in minus expense.
- [ ] Close today with the counted cash. → A difference is recorded if it doesn't match.
- [ ] Reports → Outstanding ageing. → Customer total equals the customer's pending amount.
- [ ] Download a report as Excel and as CSV. → Both open.
- [ ] Excel & backup → "Download full export (.zip)". → A zip downloads.

## 5. Reminders and calls
- [ ] On a customer, "Send now" for a payment reminder. → Message with amount and statement link in "Messages sent".
- [ ] Note a promise to pay. → A call is added for that day and automatic reminders pause.

## 6. Staff and access (important)
- [ ] Add a staff member as Field rep. Sign in as them (9000000003).
- [ ] They see no customers until you give them some. Direct links to other customers, bills, reports, settings → "not allowed" / not found.
- [ ] They cannot open Cash in the drawer, and Shop expenses lists only their own.

## 7. Field work
- [ ] "Salesmen on the road": Start my day, check in at a customer, take an order, collect ₹500, check out. → All saved; manager's "Staff & targets" page shows the visit.
- [ ] Switch off the network in the browser, take an order → "waiting to upload"; switch it on → uploads once, no duplicate.

## 8. Settings and views
- [ ] Settings → You & your security → set language Telugu. → Menus switch (not every screen is translated yet; see below).
- [ ] Set "Accountant view". → Bills show a GST register, balances show Dr / Cr. Switch back to Simple.
- [ ] Connect to Tally → make a key. → Key shown once. (The Tally agent needs a real Tally; not tested with one.)

## Known gaps
- Telugu, Hindi, Tamil, Kannada text is partly machine-written and covers only the main screens; newer screens show English.
- Real WhatsApp / SMS / UPI gateway / Tally were never run against real accounts.
- Uploaded photos and files are lost when the free Render service redeploys.
- Because sign-in codes show on screen, anyone with the link can sign in as any number. Keep real data out of this site.
