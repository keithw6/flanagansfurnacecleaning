# Rosa's appointment reminders for tomorrow: drafts for Keith to approve

Two parts, because the task that can read ServiceMonster has no Gmail, and the task with
Gmail can't reach ServiceMonster. They meet in the arcade's records (`rosa/reminders`).

## Part 1: PREP (1:52 PM, the "Rosa · 1:52 PM" task, ServiceMonster side)

1. With ArtifactData (the arcade artifact): get `penny/accounts`, save it as accounts.json
   (else `{"commercial":[],"notCommercial":[]}`); get `rosa/reminders` (else `{"sent": []}`).
2. `node tools/rosa/reminders.mjs --commercial=accounts.json --out=rosa-out`
   (reads ServiceMonster only; the appointment day is tomorrow). If ServiceMonster can't
   be reached, push Keith the exact error and stop.
3. Drop rows in `send`, `ask` and `call` whose WO and date are already in `rosa/reminders` sent.
4. Update `rosa/reminders` (pin if_version): `pending` = `{date, builtAt: now, send, ask,
   call, skipped}` from rosa-out/reminders.json (`call` = residential customers with no email
   address or "Do not email": Keith calls or texts them instead) (with the drops). Nothing else. No push unless
   something failed (the Mail room pushes).

## Part 2: DRAFTS (2:05 PM, "Rosa · Mail room", Gmail side)

1. Get `rosa/reminders`. If there is no `pending`, or `pending.builtAt` isn't from today,
   push Keith "Rosa: today's reminder list wasn't built (the 1:52 PM task didn't run or
   failed)." and stop. If `pending.send`, `pending.ask` and `pending.call` are all
   empty, push "Rosa: no residential reminders for tomorrow." then clear `pending` and stop.
   If only `pending.call` has rows, skip to step 4 (nothing to draft) and do the CALL part of
   step 5.
2. For each row in `pending.send`: create a Gmail DRAFT (create_draft) to that row's email
   with the reminder in `tools/rosa/REMINDER.md` (subject, plain text as `body`, HTML as
   `htmlBody`), filled in from the row. Never call send_message for a customer.
3. For each row in `pending.ask` (looks commercial): create the same DRAFT, and put
   "CHECK: looks commercial ([why])" in your summary for that one.
4. Update `rosa/reminders` (pin if_version): add every drafted row to `sent` as
   {wo, accountID, name, date, at: now, drafted: true} (never the email address), keep
   only the last 60 days, set `toCall` to the rows of `pending.call` (Keith's call-or-text list;
   the arcade shows it until the date passes), and remove `pending` (that clears the email addresses).
5. Push Keith: "Rosa: [n] reminder drafts ready for tomorrow ([names]). Read them in
   Gmail Drafts, then reply 'send them' (or 'send all but X') in this session and I'll
   send them from keith@homeprosgroup.com." (add "[m] look commercial: check before
   sending" when there are any). Say the same here, with the skipped jobs and why.
   CALL: never let a residential customer go without a reminder silently. For each row in
   `pending.call`, add to the push (or send it on its own if there were no drafts):
   "No email for [name]: call or text [phone] about tomorrow [time] at [address]." and in
   this session give a ready-to-send text for each: "Hi [first name], it's Keith from Home
   Pros Group. Just a reminder that we'll be at [address] tomorrow ([day]) at [time] for
   your furnace and duct cleaning. Reply here or call 780-932-7337 if you need to change
   anything. Thanks!" Also add each one to `sent` with `called: true` only after Keith
   says he called or texted; otherwise leave it out of `sent`.
   Why: drafts made here start out from keithwickseo@gmail.com, so a draft sent from
   Gmail goes out under the wrong name unless Keith changes From to keith@homeprosgroup.com.
6. When Keith replies to send (all, or all but some): for each approved reminder send a
   NEW message with send_message (to, subject, body, htmlBody exactly as in the draft; do
   NOT pass draftId), so it goes from keith@homeprosgroup.com. Then tell Keith the drafts
   can be deleted (never delete them yourself) and say what went out.

Never send to customers unless Keith says so in this session, and never draft for Jayman, builders or anyone skipped.
ServiceMonster is read only. Never delete or trash mail.
