# Home Pros email setup checklist

Do this on your computer with Claude in Chrome. Log in to Namecheap and Gmail
yourself first; never type a password into a chat. Ask Claude in Chrome:
"Set up my Home Pros email from this checklist" and paste this file.

## A. Namecheap (Private Email for homeprosgroup.com)

1. Open Private Email for homeprosgroup.com and the keith@homeprosgroup.com mailbox.
2. Add three aliases to keith@: **bookings@**, **accounts@**, **receipts@**.
3. Note how keith@ mail reaches Gmail: a forwarding rule in Private Email, or Gmail
   fetching it ("Check mail from other accounts"). Aliases must reach Gmail the same way.
4. Domain DNS (Domain List → homeprosgroup.com → Advanced DNS, or Private Email's DNS page):
   - MX records point to Private Email (mx1.privateemail.com, mx2.privateemail.com).
   - SPF: one TXT record on `@` that includes `spf.privateemail.com`, for example
     `v=spf1 include:spf.privateemail.com ~all`. Only one SPF record.
   - DKIM: turn it on for Private Email; it adds a TXT record (`default._domainkey`).
   - DMARC: TXT on `_dmarc` such as `v=DMARC1; p=none; rua=mailto:keith@homeprosgroup.com`
     to start (it can be tightened to `quarantine` after a few clean weeks).
   Don't delete any record you don't recognise; ask first.

## B. Gmail (keithwickseo@gmail.com)

1. Send a test from your phone to each alias. All three should arrive in Gmail.
2. Labels: create **Rosa** and **Penny**.
3. Filters (Settings → Filters and Blocked Addresses → Create a new filter):
   - To `bookings@homeprosgroup.com` → Apply label Rosa, never send to spam.
   - From `postmaster@hyphensolutions.net` → Apply label Rosa, never send to spam.
   - To `accounts@homeprosgroup.com OR receipts@homeprosgroup.com` → Apply label Penny, never send to spam.
4. Send mail as (Settings → Accounts → Add another email address), for keith@,
   bookings@ and accounts@: SMTP `mail.privateemail.com`, port 465, SSL, username
   `keith@homeprosgroup.com` and its password (typed by you). Untick "Treat as an alias".
   Set "When replying to a message: reply from the same address it was sent to".
5. Signatures: paste each from `tools/eddie/signatures.html` and set them as the
   default for their address.

## C. Tell Claude it's done

Say "email is set up" in the Home Pros session. Claude then sends a test to each
address, checks the labels, sends one test reply from bookings@, and switches Rosa,
Penny and Eddie to the new labels.
