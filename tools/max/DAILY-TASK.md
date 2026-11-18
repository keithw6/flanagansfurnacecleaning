# Max's thank-you and Google review emails: drafts for Keith to approve

Two parts, because the task that can read ServiceMonster has no Gmail, and the task with
Gmail can't reach ServiceMonster. They meet in the arcade's records (`eddie/reviews`).

## Part 1: PREP (5:55 PM, the "Max · 5:55 PM" task, ServiceMonster side)

1. With ArtifactData: get `penny/accounts` and `eddie/reviews`; save them as
   accounts.json and sent.json (else `{"sent": []}`).
2. NOTES FIRST: if `eddie/reviews` has `notePending` (emails Keith approved and sent since
   the last run), write it to sentlog.json as `{"sent": [...]}` and run
   `node tools/max/note.mjs --sent=sentlog.json` to add a "Review request emailed" note on
   each customer's ServiceMonster account (the only thing Max writes to ServiceMonster).
   Then move those rows from `notePending` into `noted` (keep the last 200). If a note
   fails, leave that row in `notePending` and say so.
3. `node tools/max/reviews.mjs --commercial=accounts.json --sent=sent.json --out=max`
   (reads ServiceMonster only). If ServiceMonster can't be reached, push Keith the exact
   error and stop.
4. Update `eddie/reviews` (pin if_version): `pending` = `{date, builtAt: now, send,
   skipped}` from max/reviews.json. No push unless something failed.

## Part 2: DRAFTS (6:03 PM, "Max · Mail room", Gmail side)

0. Get `eddie/reviews`. If it has `drafted` rows from an earlier day, check Gmail Sent
   (subject "Thank you from Home Pros Group", newer_than:7d) for each: the ones Keith sent
   go into `sent` and `notePending`; drop the rest from `drafted` (not approved).
1. Using that `eddie/reviews`: If there is no `pending` or `pending.builtAt` isn't from today,
   push Keith "Max: today's list wasn't built (the 5:55 PM task didn't run or failed)."
   and stop. If `pending.send` is empty, push "Max: no residential jobs to thank today.",
   clear `pending` and stop.
2. For each row in `pending.send`, create a Gmail DRAFT (create_draft) to that row's email
   with `tools/max/EMAIL.md` ({FIRST} = firstName): subject, plain text as `body`, HTML as
   `htmlBody`. One draft each. Never call send_message on your own.
3. Update `eddie/reviews` (pin if_version): `drafted` = the rows without email addresses
   ({wo, orderID, accountID, name, date, draftId}); remove `pending`.
4. Push Keith: "Max: [n] thank-you drafts ready ([names]). Read them in Gmail Drafts, then
   reply 'send them' (or 'send all but X') in this session and I'll send them from
   keith@homeprosgroup.com." List them here with the skipped jobs and why.
   Why: drafts made here start out from keithwickseo@gmail.com, so a draft sent from Gmail
   goes out under the wrong name unless Keith changes From to keith@homeprosgroup.com.
5. When Keith replies to send (all, or all but some): for each approved row send a NEW
   message with send_message (to, subject, body, htmlBody exactly as in the draft; do NOT
   pass draftId), so it goes from keith@homeprosgroup.com. Then tell Keith the drafts can
   be deleted (never delete them yourself). For each that went out, add {wo, orderID,
   accountID, name, date} to `eddie/reviews` → `sent` and `notePending` (the 5:55 PM task
   adds the ServiceMonster notes), and remove it from `drafted`. Tell Keith what went out.
   If Keith sends drafts himself from Gmail, step 0 of the next run picks them up.
