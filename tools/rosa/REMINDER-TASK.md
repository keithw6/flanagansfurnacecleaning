# Rosa's appointment reminders for tomorrow: drafts for Keith to approve

Two parts, because the task that can read ServiceMonster has no Gmail, and the task with
Gmail can't reach ServiceMonster. They meet in the arcade's records (`rosa/reminders`).

## Part 1: PREP (1:52 PM, the "Rosa · 1:52 PM" task, ServiceMonster side)

1. With ArtifactData (the arcade artifact): get `penny/accounts`, save it as accounts.json
   (else `{"commercial":[],"notCommercial":[]}`); get `rosa/reminders` (else `{"sent": []}`).
2. `node tools/rosa/reminders.mjs --commercial=accounts.json --out=rosa-out`
   (reads ServiceMonster only; the appointment day is tomorrow). If ServiceMonster can't
   be reached, push Keith the exact error and stop.
3. Drop rows in `send` and `ask` whose WO and date are already in `rosa/reminders` sent.
4. Update `rosa/reminders` (pin if_version): `pending` = `{date, builtAt: now, send, ask,
   skipped}` from rosa-out/reminders.json (with the drops). Nothing else. No push unless
   something failed (the Mail room pushes).

## Part 2: DRAFTS (2:05 PM, "Rosa · Mail room", Gmail side)

1. Get `rosa/reminders`. If there is no `pending`, or `pending.builtAt` isn't from today,
   push Keith "Rosa: today's reminder list wasn't built (the 1:52 PM task didn't run or
   failed)." and stop. If `pending.send` and `pending.ask` are both empty, push "Rosa: no
   residential reminders for tomorrow." then clear `pending` and stop.
2. For each row in `pending.send`: create a Gmail DRAFT (create_draft) to that row's email
   with the reminder in `tools/rosa/REMINDER.md` (subject, plain text as `body`, HTML as
   `htmlBody`), filled in from the row. Never call send_message for a customer.
3. For each row in `pending.ask` (looks commercial): create the same DRAFT, and put
   "CHECK: looks commercial ([why])" in your summary for that one.
4. Update `rosa/reminders` (pin if_version): add every drafted row to `sent` as
   {wo, accountID, name, date, at: now, drafted: true} (never the email address), keep
   only the last 60 days, and remove `pending` (that clears the email addresses).
5. Push Keith: "Rosa: [n] reminder drafts ready in Gmail for tomorrow ([names]). Read and
   send the ones you approve." (add "[m] look commercial: check before sending" when
   there are any). Say the same here, with the skipped jobs and why.

Never send to customers yourself, and never draft for Jayman, builders or anyone skipped.
ServiceMonster is read only. Never delete or trash mail.
