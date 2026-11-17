# Rosa's 2 PM task: appointment reminders for tomorrow (one task, Gmail + ServiceMonster)

This task runs in the "flanagansfurnacecleaning" environment (it can read
ServiceMonster) with the Gmail connector on, so it does the whole job itself.

1. With ArtifactData (the arcade artifact): get `penny/accounts` and save it as
   accounts.json (else `{"commercial":[],"notCommercial":[]}`); get `rosa/reminders`
   (else `{"sent": []}`).
2. `node tools/rosa/reminders.mjs --commercial=accounts.json --out=rosa-out`
   (reads ServiceMonster only; the appointment day is tomorrow). If it can't reach
   ServiceMonster, push Keith the exact error and stop.
3. Drop any row in `send` or `ask` whose WO and date are already in `rosa/reminders` sent.
   If both are empty: push Keith "Rosa: no residential reminders for tomorrow." and stop.
4. RESIDENTIAL (`send`): send each one the email in `tools/rosa/REMINDER.md` with
   send_message (subject, plain text as `body`, HTML as `htmlBody`), filled in from the
   row. One email each, only to the address in the row.
5. LOOKS COMMERCIAL (`ask`): never send these. For each, create a Gmail DRAFT of the same
   reminder (create_draft). Then send ONE email to keith@homeprosgroup.com, subject
   "Rosa: approve or deny [n] reminder(s) for tomorrow", listing WO, name, time, address
   and why it looks commercial, ending with: "The reminders are waiting in Gmail Drafts.
   Send the ones you approve; delete the ones you deny." Right after sending it, add the
   labels INBOX and UNREAD to it (update_message_labels with the id send_message returned).
6. Add what went out (and the drafted ones) to `rosa/reminders` → `sent`:
   {wo, accountID, name, date, at, drafted: true for ask rows}, never the email address,
   pinned to the version read in step 1. Keep only the last 60 days.
7. Push Keith: "Rosa: [n] reminders sent for tomorrow ([names]). [m] waiting for your OK
   in Gmail Drafts." (leave out the last part when there are none). Same summary here,
   with the skipped jobs and why.

Never send to Jayman, builders, commercial accounts or anyone skipped. ServiceMonster is
read only for this task. Never delete or trash mail.
