# Max's 6 PM task: thank-you and Google review emails (drafts for Keith to approve)

Runs every evening at 6:00 PM Alberta time. Max NEVER sends on his own: every night
he makes Gmail drafts and Keith approves them.

1. Get the arcade docs `penny/accounts` and `eddie/reviews` (ArtifactData, the arcade
   artifact). Save them as accounts.json and sent.json. If `eddie/reviews` doesn't exist,
   use `{"sent": []}`.
2. `node tools/max/reviews.mjs --commercial=accounts.json --sent=sent.json --out=max`
   (reads ServiceMonster only).
3. For each customer in `max/reviews.json` → `send`, create a Gmail DRAFT
   (create_draft) with the email in `tools/max/EMAIL.md`, {FIRST} = firstName: subject,
   plain text as `body`, HTML as `htmlBody`, to the customer's email. Never draft for
   anyone not on the list, one draft each. Never call send_message on your own.
4. Push Keith: "Max: [n] thank-you emails drafted for today's customers ([names]).
   Open the session to approve, or send them from Gmail Drafts." List them here (WO,
   name) and the skipped jobs with the reason.
5. Wait for Keith. He can approve all ("send them"), some ("send all but X"), or none.
   Send only the drafts he approves, with send_message and the draftId. Delete nothing.
   If he sends them himself from Gmail, check Sent before doing anything.
6. Only for the emails that really went out: write sentlog.json
   `{"sent": [{wo, orderID, accountID, name, date}]}` and run
   `node tools/max/note.mjs --sent=sentlog.json` to add a "Review request emailed" note on
   each customer's ServiceMonster account. That note is the only thing Max writes to
   ServiceMonster. If a note fails, report it; don't retry more than once.
7. Add the sent ones to `eddie/reviews` → `sent` (accountID, wo, name, date; never the
   email address), pinned to the version read in step 1. Tell Keith what went out.
