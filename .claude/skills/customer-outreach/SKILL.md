---
name: customer-outreach
description: Find past Flanagan's customers in ServiceMonster by service date range and area (NE Calgary, Airdrie, Saddle Ridge, a postal code…), then offer to reach them by email (Gmail drafts) or physical mail (print-ready letters and a mailing CSV) about one of our services. Use when the user asks to "reach out to customers", "find customers we did in <dates> in <area>", "send a reminder/promo to past customers", "who's due for a cleaning", or "mail our customers in <area>".
---

# Customer outreach from ServiceMonster

Pull past customers from ServiceMonster who match a date range and an area, show who they are, then offer email and/or physical mail for one service. Nothing goes out without the user approving it.

All the API work runs through `scripts/sm_outreach.py` (Python 3, standard library only). Run it from the repository root.

## Hard rules

- **Customer data never enters git.** It goes in `outreach-output/`, which is gitignored. This repo is public: it is the website. Never commit, push, publish or paste customer lists anywhere outside this session and the user's own Gmail.
- **Never send email.** Create Gmail drafts only. The user reviews and sends them.
- **Respect CASL** (Canada's anti-spam law). Email only customers whose last paid service is within 2 years (`email_ok` already applies this), and give every email the business name, mailing address, phone, and a working way to unsubscribe. Customers outside 2 years can still get physical mail.
- Skip anyone ServiceMonster marks do-not-contact or inactive. The script does this. Never work around it.
- Don't invent prices, discounts or deadlines. Take them from `_src/pages/pricing.html` and the service page, or from the user.

## Step 1: Pin down the request

You need three things. Ask once, in one message, for whatever is missing:

1. **Date range** of past service, e.g. "Sept–Dec 2024". Turn it into `--from YYYY-MM-DD --to YYYY-MM-DD`.
2. **Area**: any mix of a quadrant (`NE Calgary`), a town (`Airdrie`, `Chestermere`, `Strathmore`, `Langdon`), a community from `areas.json` (`Saddle Ridge`), or a postal prefix (`T3J`). Comma-separate several. Leave it empty for everywhere.
3. **Which customers in that range**:
   - `--mode any` (default): served at least once in the range.
   - `--mode last`: their most recent service fell in the range, meaning they haven't been back since. This is the one for "due for a cleaning" reminders, e.g. last cleaned 2 years ago.

Optional: `--service 'dryer|vent'` keeps only orders mentioning that service.

## Step 2: Check the connection (first run of a session)

```
python3 .claude/skills/customer-outreach/scripts/sm_outreach.py probe
```

- **Cannot reach / 403 from the proxy**: `api.servicemonster.net` isn't allowed on this network. Tell the user the host has to be allowed in the environment's network settings, and stop.
- **401**: no valid key. The user creates one in ServiceMonster: log in at six.servicemonster.net as an admin, go to Settings → API Users → **+API User**, pick role **Read Only** (this skill never writes), and save the username and password it shows, because the password can't be retrieved later. In a cloud session, ask for that username and password with the credential tool, host `api.servicemonster.net`, type basic; the proxy then adds the header and `SERVICEMONSTER_BASIC_TOKEN` stays unset. Locally, the Basic token is base64 of `username:password` and goes in the `SERVICEMONSTER_BASIC_TOKEN` environment variable. Never let the credentials appear in chat or in a file in the repo.
- **Success** prints field names (no customer values). Check that the order date, account ID, email and address fields map to names in the `F` table at the top of the script. If a real name is missing, add it to that table. Also pick the order date field for server-side filtering and pass it as `--date-field <name>`, or set `SERVICEMONSTER_ORDER_DATE_FIELD`. Prefer a completed date over a scheduled one.

## Step 3: Build the list

```
python3 .claude/skills/customer-outreach/scripts/sm_outreach.py find \
  --from 2024-09-01 --to 2024-12-31 --area "NE Calgary, Airdrie" --mode last --date-field <field>
```

It prints a JSON summary and writes `outreach-output/outreach_<range>_<area>.json` and `.csv`. Each row has name, email, phone, mailing address, service address, matched area, dates, `email_ok`, `mail_ok`, and `notes` explaining any "no".

Report back briefly:

- How many customers matched: email-ready, mail-ready, and neither.
- How many matches are `approximate`. Community names fall back to the postal FSA, which also takes in neighbouring communities, so offer to drop those or keep them.
- What was skipped (outside the area, do-not-contact, inactive).
- A sample of up to 10 rows: name, area, last service, channel. Not the whole list.

Point the user to the CSV path if they want to look it over.

## Step 4: Offer the outreach

Ask, in one message:

1. **Which service** to promote. Use the site's services: furnace & duct cleaning, dryer vent cleaning, system sanitization, VacuFlo central vacuum, indoor air quality, commercial duct cleaning. Suggest one that fits the list, e.g. `--mode last` 2+ years ago → furnace & duct cleaning reminder.
2. **Which channel**: email to `email_ok` customers, physical mail to `mail_ok` customers, or both. "Both" can mean mailing only the people without a usable email, which is the `letters` default, or everyone (`--all`).
3. **Any offer**: price, discount, deadline. Read `_src/pages/pricing.html` for current prices and quote them exactly.

Then draft **one** message and show it to the user before producing anything per customer. Write in the site's voice: plain, owner-operated, no hype. Read `_src/pages/index.html` for tone. Personalize with `{{first_name}}`, `{{last_service_text}}` (e.g. "November 2024") and `{{matched_area}}`. Mention when we last serviced their home if that helps, e.g. "it's been about 2 years". Keep it short. Use `templates/email.md` as the starting point.

## Step 5: Produce it, once the user approves the draft

**Email**: for each `email_ok` customer, create a Gmail draft with the Gmail `create_draft` tool. Fill the placeholders per customer, and use plain text unless the user asks otherwise. Before creating more than 25 drafts, confirm the count with the user. Report how many drafts were created, and tell them they're in Gmail Drafts to review and send. Never send.

**Physical mail**:
1. Write the approved letter body to `outreach-output/letter_body.txt`. Paragraphs are separated by blank lines, and `{{first_name}}`-style placeholders are allowed.
2. Run:
   ```
   python3 .claude/skills/customer-outreach/scripts/sm_outreach.py letters \
     --list outreach-output/outreach_<…>.json --body outreach-output/letter_body.txt [--all]
   ```
3. That produces `…_letters.html`: one letter per page, with letterhead and the address placed for a #10 left-window envelope. Tell the user to open it in a browser and print. The `.csv` doubles as a mail-merge file for labels or a print-and-mail service such as Canada Post Smartmail Marketing or PostGrid.

## Step 6: Close out

Summarize what was produced: drafts created, letters file, CSV path. Suggest logging the campaign as a note in ServiceMonster so the next run can exclude recent recipients. The script is read-only against ServiceMonster and doesn't write notes itself.
