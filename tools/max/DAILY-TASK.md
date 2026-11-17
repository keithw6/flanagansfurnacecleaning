# Max's 6 PM task: thank-you and Google review emails (drafts for Keith to approve)

Max's task has ServiceMonster but no Gmail. He builds the list and hands it to
his Mail room task (Gmail), which makes the drafts. Keith approves every night.

## Normal run (6:00 PM)

1. Get the arcade docs `penny/accounts` and `eddie/reviews` (ArtifactData, the arcade
   artifact). Save them as accounts.json and sent.json (else `{"sent": []}`).
   If `eddie/reviews` → `lastHandOff` is today's date (Alberta), today's list was already
   handed off: end the turn with "Already handed off today; waiting for notes." and do
   nothing else (a "NOTES FOR MAX:" message may follow; then do the Notes run).
2. `node tools/max/reviews.mjs --commercial=accounts.json --sent=sent.json --out=max`
   (reads ServiceMonster only).
3. If `send` is empty: push Keith "Max: no residential jobs to thank today." and stop.
4. Find the Mail room: list_triggers, the enabled one whose name starts with
   "Max · Mail room". If there is none, push Keith "Max: the Mail room task isn't set
   up yet, so no drafts were made (see tools/setup/2-MAX-MAIL-ROOM.md)." and list who would
   have been thanked here, then stop.
5. fire_trigger on it with text = "HAND-OFF FROM MAX" + newline + JSON
   `{"type": "review-drafts", "date", "notesTrigger": "<this task's trigger id>", "send": [...], "skipped": [...]}`
   copied from max/reviews.json. This task's trigger id is trig_01BSH9agxKJQVPBirXBCTr4z.
   Then update `eddie/reviews` (pinned): `lastHandOff` = today's date.
6. Say here who was handed off and who was skipped and why. No push (the Mail room pushes).

## Notes run (started by the Mail room after Keith approves)

If this turn contains a block starting "NOTES FOR MAX:", it lists the emails that
really went out. Do not run the normal steps. Instead:
1. Save the JSON as sentlog.json and run `node tools/max/note.mjs --sent=sentlog.json`
   to add a "Review request emailed" note on each customer's ServiceMonster account. That
   note is the only thing Max writes to ServiceMonster. If a note fails, report it; don't
   retry more than once.
2. Add them to `eddie/reviews` → `sent` (accountID, wo, name, date; never the email
   address), pinned to the version you read.
3. Push Keith: "Max: noted [n] review requests in ServiceMonster." (or what failed).
