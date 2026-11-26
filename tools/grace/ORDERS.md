# Grace · Orders from Keith

Keith talks to Grace in the arcade ("Talk to Grace"). When something they discuss needs a
director to act right away, and it needs ServiceMonster or a director's own tools, Grace
writes an order and starts this task. **Keith approved every order on screen before it was
sent** (he tapped Approve on the order card). You carry it out now, then report.

The arcade is the artifact https://claude.ai/artifact/UzjFfo9KUmPYRwdU25ieFS (ArtifactData
tool). Orders live in `grace/orders` = `{items: [{id, at, director, task, details, status,
approvedAt, result, problems, finishedAt, session}]}`. Pin `if_version` on every write.

## Steps

1. The message after the task prompt is JSON `{orderId}`, or `{chequeId}` when Keith sent a
   Jayman cheque from Penny's desk. If there is neither, end with one line ("Waiting for an
   order.") and stop.
   **Cheques** (`{chequeId}`): get `penny/cheques`, find the item, and do the jayman-payments
   skill's rules as Penny with the stub already read in `item.stub` (the photos are at
   `item.photos`): check the lines add up, match each PO to its invoice (ServiceMonster orders
   `wField=RefNumber`), FIRST look for a payment already entered (GET /credits with
   wField=memo like the cheque number); then set `item.status` = "held" with `item.result` =
   {summary, applied: [], paid: [already-paid lines], held: [lines with why], problems} and the
   proposed payment (one Check credit dated the cheque date, ref = cheque number, splits to each
   matching invoice for exactly its balance). Do NOT post the payment: Keith approves it in Talk
   to Grace or on Penny's desk, which comes back here as an order. Push Keith the summary.
2. Get `grace/orders`. Find the order. If it isn't there, or its status isn't `sent`, or it
   has no `approvedAt`, change nothing: push Keith "Grace: order not found or not approved"
   and stop. Set its status to `working` and `session` to this session's link.
3. Do the task as the named director, using that director's own instructions in this repo
   (check out what you need with git):
   - **Rosa** (bookings, Jayman, reminders): tools/rosa (README.md, jayman-sm.mjs,
     REMINDER-TASK.md). Booking a customer: same pattern as Rosa's bookings (account, site,
     work order, line items, job), checking the calendar slot is free first.
   - **Penny** (money): tools/penny (README.md, brief.mjs, payoff.mjs for payments: a payment
     is POST /credits with splits). Jayman cheques: the jayman-payments skill rules
     (match to the cent; never apply more than an invoice's balance; check for payments
     already entered first).
   - **Max** (reviews, contacts, posts, website articles): tools/max. Publishing an approved
     article: tools/max/ARTICLE-TASK.md Part 3 (the homeprosgroup.com publisher). **Hank** (purchasing): arcade doc
     `hank/list`. **Eddie** (email): this task has no Gmail, so say what Eddie needs and
     leave it for Keith.
   Run node with `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
4. Rules, even with Keith's approval:
   - Do exactly the order, nothing more. Re-check ServiceMonster right before every change
     (so nothing is double-booked, double-paid or stale).
   - Never delete anything in ServiceMonster. Never send email to a customer (no Gmail here).
   - If anything is unclear, doesn't match, or would need a guess (a missing address, an
     amount that doesn't tie out, two possible customers), change nothing for that part and
     put the question in `problems`.
5. Update the order: `status` = `done` (all of it done), `held` (some parts need Keith) or
   `problem` (nothing could be done), `result` = short lines of exactly what you changed
   (e.g. "Booked WO 45990, Mon Jan 11 1:30 PM, 9835 67 Ave, $345.00 + GST"), `problems` =
   short lines, `finishedAt` = now. If the order cleared something on Keith's list, also mark
   it done where it lives (grace/notes item status "done", or add the item's text to
   `grace/cleared` items as `{key, text, at}`).
6. Push Keith one notification: "Grace: [director] did it: [one line]" (or what needs him),
   and say the same here.

Do not commit or push anything to git. If a stop hook asks you to commit, say in one line
that this run must not commit, and stop.
