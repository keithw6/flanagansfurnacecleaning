# Penny: nightly accounting brief

Penny (Accounting in the Home Pros back office) runs every night at about 8 PM
Alberta time as a scheduled Claude task, in the cloud environment that holds the
ServiceMonster login. She only reads ServiceMonster; she never changes it.

1. Each job counts on the day it was done on the calendar, even when the invoice
   has another Date Completed. Jayman jobs always count as billed.
   `node tools/penny/brief.mjs --commercial=accounts.json --out=penny` makes
   `penny/brief.json`: today's completed jobs (revenue, billed, paid, GST, km,
   paid or not paid for each non-Jayman job), month to date against the same days
   last month (jobs, revenue, average job, revenue per km), and the running list of
   non-Jayman invoices with a balance (oldest first, over 30 and 60 days), with
   commercial accounts on billing listed separately.
2. She writes it to the arcade's database (`penny/brief`), so it shows on her desk.
3. She reports to Keith in her session, asks once about company names that might
   be commercial accounts on billing, and asks for the day's receipts.
4. Receipts entered on her desk in the arcade (Add a receipt: phone photo, Penny
   reads it, Keith confirms category and how he paid) are already in
   `penny/expenses-YYYY-MM` with `enteredIn: "arcade"` and `photoId` (the photo is in
   the arcade's asset store). At night she lists those and asks only for others.
5. Receipts in her session: Keith sends photos or tells her. For each she confirms the vendor,
   date, amount, GST and how it was paid, and suggests a category, asking when it's
   not clear. She saves them to `penny/expenses-YYYY-MM` and updates the brief.

## Arcade database (only Keith and editors can read or write)

| doc | what |
|---|---|
| `penny/brief` | the latest `brief.json` (with `notInvoiced`: non-Jayman jobs done but still work orders), plus `session` (her session link) |
| `penny/accounts` | `{commercial: [{accountID, name}], notCommercial: [...]}` from Keith's answers |
| `penny/expenses-YYYY-MM` | `{month, items: [{date, vendor, category, amount, gst, paidWith, note, photoId, enteredIn, enteredAt}]}`. `amount` includes GST |

## Expense categories

Fuel; Vehicle repairs and maintenance; Vehicle insurance and registration;
Supplies and materials; Tools and equipment; Advertising and marketing;
Phone and internet; Office and software; Meals (50% deductible); Subcontractors;
Insurance; Bank and card fees; Other. These follow the usual CRA business expense
lines; Keith's accountant has the final say.
