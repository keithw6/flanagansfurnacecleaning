# Max's 6 PM task: thank-you and Google review emails

Runs every evening at 6:00 PM Alberta time.

1. Get the arcade docs `penny/accounts` and `eddie/reviews` (ArtifactData, the arcade
   artifact). Save them as accounts.json and sent.json. If `eddie/reviews` doesn't exist,
   use `{"sent": [], "autoSend": false}`.
2. `node tools/max/reviews.mjs --commercial=accounts.json --sent=sent.json --out=max`
   (reads ServiceMonster only).
3. For each customer in `max/reviews.json` → `send`, the email is `tools/max/EMAIL.md`
   with {FIRST} = firstName: subject, plain text as `body`, HTML as `htmlBody`, to the
   customer's email. Never send to anyone not on the list, and only one email each.
   - `autoSend` false (until Keith approves): create Gmail drafts, push Keith the list
     and wait for his OK in the session. When he says send: send each draft
     (send_message with draftId), then set `autoSend: true`.
   - `autoSend` true: send right away.
4. Only for the emails that really went out: write sentlog.json
   `{"sent": [{wo, orderID, accountID, name, date}]}` and run
   `node tools/max/note.mjs --sent=sentlog.json` to add a "Review request emailed" note on
   each customer's ServiceMonster account. That note is the only thing Max writes to
   ServiceMonster. If a note fails, report it; don't retry more than once.
5. Add the sent ones to `eddie/reviews` → `sent` (accountID, wo, name, date; never the
   email address), pinned to the version read in step 1.
6. Push Keith one line: how many were thanked, how many skipped and why.
