# Rosa's 2 PM task: appointment reminders for tomorrow

Runs every day at 2:00 PM Alberta time.

1. Get the arcade doc `penny/accounts` (ArtifactData, the arcade artifact) and save it
   as accounts.json (else `{"commercial":[],"notCommercial":[]}`). Get `rosa/reminders`
   (else `{"sent": []}`).
2. `node tools/rosa/reminders.mjs --commercial=accounts.json --out=rosa-out`
   (reads ServiceMonster only; the appointment day is tomorrow).
3. RESIDENTIAL (`send`): skip anyone already in `rosa/reminders` sent for the same WO
   and date. Send each one the email in `tools/rosa/REMINDER.md` with send_message
   (subject, plain `body`, `htmlBody`), filled in from their row. One email each,
   only to the address in the row. Send nothing to anyone not in `send`.
4. LOOKS COMMERCIAL (`ask`): never send these yourself. For each one, create a Gmail
   DRAFT of the same reminder to the customer (create_draft). Then send ONE email to
   keith@homeprosgroup.com:
     Subject: Rosa: approve or deny [n] reminder(s) for tomorrow
     Body: for each: WO, name, time, address, why it looks commercial. Then:
     "The reminders are waiting in Gmail Drafts. Send the ones you approve; delete the
     ones you deny. Anything not sent just doesn't go out."
   Right after sending that email, add the INBOX and UNREAD labels to it
   (update_message_labels with the id send_message returned), or Gmail keeps it only
   under Sent.
5. Add what went out to `rosa/reminders` → `sent`: {wo, accountID, name, date, at}
   (never the email address), pinned to the version read in step 1. Keep only the last
   60 days.
6. Push Keith one line: "Rosa: [n] reminders sent for tomorrow ([names]). [m] waiting
   for your OK in Gmail Drafts." (leave out the last part when there are none). Same
   summary here, with the skipped jobs and why.

ServiceMonster is read only for this task. Never change anything there.
