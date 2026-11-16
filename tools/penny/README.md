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
| `penny/marks` | `{jobs: {"<WO>": {how: "billed" or "paid", method, at}}}`: Keith's answer for unpaid non-Jayman jobs. Paid on site counts as paid and goes on the "record it in ServiceMonster" list until ServiceMonster shows it paid |
| `penny/accounts` | `{commercial: [{accountID, name}], notCommercial: [...]}` from Keith's answers |
| `penny/expenses-YYYY-MM` | `{month, items: [{date, vendor, category, amount, gst, paidWith, note, photoId, enteredIn, enteredAt}]}`. `amount` includes GST |

## Expense categories

Fuel; Vehicle repairs and maintenance; Vehicle insurance and registration;
Supplies and materials; Tools and equipment; Advertising and marketing;
Phone and internet; Office and software; Meals (50% deductible); Subcontractors;
Insurance; Bank and card fees; Other. These follow the usual CRA business expense
lines; Keith's accountant has the final say.

## Write-offs (Nov 16, 2026)

On Keith's instruction Penny marked 19 old invoices paid, $8,438.83, with
`tools/penny/payoff.mjs`: every invoice completed before Jan 1, 2026 with a balance,
and residential invoices (not Jayman, not commercial) completed Jan 1 to Jun 30, 2026.
Each is a ServiceMonster credit with method `Write-off`, ref `PENNY-<WO>` and a memo.
The list is in the arcade database at `penny/writeoffs`. The API cannot delete a
credit; undo one in ServiceMonster itself.

## Monthly expense reports

On her desk in the arcade, **Expenses by month** shows January to the current month
(and earlier years with the year arrows). Each month lists its receipts by
category. **Add a receipt to [month]** files a missed receipt; receipts are filed by
their own date, so they always land in the right month. **Email the [month] report**
builds a PDF in the browser (`js/expense-pdf.js`: summary, categories, every receipt,
one page per two receipt photos) and sends it to keith@homeprosgroup.com through
Keith's Gmail connector; it can be sent again after more receipts are added.
`penny/reports` records when each month was last sent. **Download PDF** saves the same file.

## Card statements

**Card statements** on Penny's desk takes a statement PDF (pages drawn with pdf.js from
cdnjs) or photos. Claude reads every transaction (`js/statement.js`), anything already
filed from a receipt (same amount within 3 days) is marked, and Keith says whose card it is:

- Business Visa (Keith) / Business Visa (Hannah): everything is business; Penny asks only
  about what looks personal. Personal items on a business card go on `penny/owed` as owed
  to the business.
- Keith's personal Mastercard: personal unless Keith says business; business items go into
  the expenses with `reimburse: "Keith"` and on `penny/owed` as owed to Keith (marked * in
  the PDF report). "Mark as paid back" clears them.

Statements are kept in `penny/statements` and `penny/stmt-<id>` (answers saved as you go),
the files in the asset store. GST defaults to 5% included; Keith can change it per item.
