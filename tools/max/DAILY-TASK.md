# Max's 6 PM task: thank-you and Google review emails (drafts for Keith to approve)

One task in the "flanagansfurnacecleaning" environment (it can read ServiceMonster) with
the Gmail connector on. Max never sends on his own: he makes drafts and waits for Keith.

1. With ArtifactData (the arcade artifact): get `penny/accounts` and `eddie/reviews`,
   save them as accounts.json and sent.json (else `{"sent": []}`).
2. `node tools/max/reviews.mjs --commercial=accounts.json --sent=sent.json --out=max`
   (reads ServiceMonster only). If it can't reach ServiceMonster, push Keith the exact
   error and stop.
3. If `send` is empty: push Keith "Max: no residential jobs to thank today." and stop.
4. For each row in `send`, create a Gmail DRAFT (create_draft) to that row's email with
   the email in `tools/max/EMAIL.md` ({FIRST} = firstName): subject, plain text as `body`,
   HTML as `htmlBody`. One draft each. Never call send_message on your own.
5. Push Keith: "Max: [n] thank-you emails drafted for today's customers ([names]). Reply
   'send them' here, or send them from Gmail Drafts." List them here (WO, name) with the
   skipped jobs and why. Then wait.
6. When Keith says to send (all, or all but some): send only the approved drafts
   (send_message with the draftId). If he says he sent them himself from Gmail, check
   Gmail Sent for them first.
7. Only for the emails that really went out: write sentlog.json
   `{"sent": [{wo, orderID, accountID, name, date}]}` and run
   `node tools/max/note.mjs --sent=sentlog.json` to add a "Review request emailed" note on
   each customer's ServiceMonster account. That note is the only thing Max writes to
   ServiceMonster. If a note fails, report it; don't retry more than once.
8. Add them to `eddie/reviews` → `sent` (accountID, wo, name, date; never the email
   address), pinned to the version you read. Tell Keith what went out.
