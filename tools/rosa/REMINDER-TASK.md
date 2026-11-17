# Rosa's 2 PM task: appointment reminders for tomorrow

Rosa's task has ServiceMonster but no Gmail. She builds the list and hands it to
Eddie's Mail room task (Gmail), which sends the reminders.

1. Get the arcade docs `penny/accounts` (else `{"commercial":[],"notCommercial":[]}`)
   and `rosa/reminders` (else `{"sent": []}`) with ArtifactData.
2. `node tools/rosa/reminders.mjs --commercial=accounts.json --out=rosa-out`
   (reads ServiceMonster only; the appointment day is tomorrow).
3. Drop any row in `send` or `ask` whose WO and date are already in `rosa/reminders` sent.
   If both are empty: push Keith "Rosa: no residential reminders for tomorrow." and stop.
4. Find the Mail room: list_triggers, the enabled one whose name starts with
   "Eddie · Mail room". If there is none, push Keith "Rosa: the Mail room task isn't set
   up yet, so no reminders went out (see tools/eddie/MAIL-ROOM.md)." and list who would
   have been reminded here, then stop.
5. fire_trigger on it with text = "HAND-OFF FROM ROSA" + newline + JSON
   `{"type": "reminders", "date", "send": [...], "ask": [...], "skipped": [...]}`
   copied from rosa-out/reminders.json.
6. Add the handed-off rows to `rosa/reminders` → `sent`: {wo, accountID, name, date, at}
   (never the email address), pinned to the version read in step 1. Keep only the last
   60 days.
7. Say here who was handed off, who needs Keith's OK, and who was skipped and why.
   No push (the Mail room pushes).

ServiceMonster is read only for this task. Never change anything there.
