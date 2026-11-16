# Eddie: daily email check

Eddie (Email Manager in the Home Pros back office) checks the email setup once a
day, after Rosa's morning run, and reports on his desk in the arcade. He reads
Gmail and never deletes, sends or changes anyone's mail, except his own test
messages (below).

## The email map

All mail for homeprosgroup.com is Namecheap Private Email. It reaches Keith's
Gmail (keithwickseo@gmail.com), and that is the inbox Rosa, Penny and Eddie read
through the Gmail connector.

| Address | Kind | Gmail label | Who reads it | What goes there |
|---|---|---|---|---|
| keith@homeprosgroup.com | mailbox | (inbox) | Keith | everything else; Jayman POs arrive here today |
| bookings@homeprosgroup.com | alias of keith@ | **Rosa** | Rosa | Jayman / Supply Pro orders, ServiceMonster booking mail, customer booking questions |
| accounts@homeprosgroup.com | alias of keith@ | **Penny** | Penny | invoices, payment and e-transfer notices, supplier bills |
| receipts@homeprosgroup.com | alias of keith@ | **Penny** | Penny | receipts Keith emails or forwards; Penny files them |

Jayman PO mail (from postmaster@hyphensolutions.net) also gets the **Rosa**
label, whichever address it is sent to.

## Eddie's daily checks

1. **Delivery.** Every address above received its mail in the last day, and his
   test message to each alias (subject `[Eddie test] <address> <date>`) arrived
   within 15 minutes with the right label.
2. **Mapping.** Every message sent to bookings@ has the Rosa label; every
   message to accounts@ or receipts@ has the Penny label; every Jayman PO has the
   Rosa label. Anything unlabelled is listed.
3. **Nothing missed.**
   - Every Jayman purchase order from the last day is in Rosa's report (ready,
     held or already booked), by PO number.
   - Every receipt sent to receipts@ in the last day is filed in Penny's
     expenses (same date and amount), or listed as waiting.
   - Customer emails (not from Jayman, ServiceMonster, banks or newsletters) with
     no reply for more than one business day are listed.
4. **Formatting.** Mail sent in the last day from homeprosgroup.com addresses:
   - comes from the right address (bookings@ for Rosa, accounts@ for Penny,
     never the gmail.com address for customer mail),
   - has a subject, a greeting and the matching signature from
     `signatures.html`,
   - says Rosa or Penny is an assistant when one of them wrote it.
   Drafts waiting for Keith's approval are counted.
5. **Report.** A short push notification only when something needs Keith, and
   the full report on his desk in the arcade (`eddie/report`). He also keeps the
   last 14 days in `eddie/history`.

## Test messages

Eddie sends one short test message from Keith's Gmail to each alias each day
and archives it after checking. Only to homeprosgroup.com addresses, never to
anyone else. If Keith turns this off (`eddie/settings` → `selfTest: false`),
Eddie only checks real mail.

## Signatures

`signatures.html` has the three signatures (Keith, Rosa, Penny) in email-safe
HTML. Paste each into Gmail: Settings → General → Signature, one per "Send mail
as" address. Open the file in a browser, select the signature, copy, paste.
