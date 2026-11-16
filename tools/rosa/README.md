# Rosa: daily Jayman booking prep

Rosa (Customer Service in the Home Pros back office) runs every morning at
about 6:00 AM Alberta time as a scheduled Claude task:

1. Reads the new Jayman purchase-order emails from `postmaster@hyphensolutions.net`
   in Gmail, and parses, prices and groups them with the **jayman-booking** skill.
2. Writes them to a plan and runs `jayman-sm.mjs check`. That checks every PO
   for an existing ServiceMonster order with the PO in its Reference field, and
   finds a slot: 8:00, 11:00, 1:00 or 3:00 on Jayman's date, 2 hours, on the
   **New Home** route. The slot must be clear on **both New Home and Edmonton
   Residential** (one truck), with at most 4 New Home calls that day.
3. Sends Keith a report with READY and HELD orders. **Approval week:** nothing is
   booked until Keith replies "approve" in that run's session. Then she runs
   `jayman-sm.mjs book ... --approved` and hands over the Supply Pro write-back sheet.

**Driving.** Jayman calls only have to happen on their day, so the time is free:
- A new call goes in the free slot that adds the least driving. Its location comes
  from past jobs on the same street (ServiceMonster stores coordinates on jobs, not
  sites), otherwise the town centre, flagged as approximate.
- `jayman-sm.mjs reorder YYYY-MM-DD` proposes swapping a day's call times so the
  closest calls are done back to back. Example: Nov 24 goes from about 142 km to
  127 km. `reorder-apply ... --approved` moves the times, after re-checking nothing
  changed.
- Distances are straight-line x 1.3, from the shop and back. Good for comparing
  orders, not a GPS route.

**Warranty calls** are booked as calendar activities (for example "Jayman Warrenty
3404 122 Street SW - Re: w0735191"). They are **timed** (the crew must arrive at that
time and they never move) and still need a **work order**.
- `jayman-sm.mjs warranty` finds them and prices each one like the original new-home
  cleaning at that address. It finds the ServiceMonster site and copies the line
  items from the first work order there. Example: 3404 122 Street SW ->
  WO 45110 (02138399-0024): furnace $230 + HRV $35 + zone $49 = $314 + GST.
- Rosa **asks Keith** for each one. Only on a yes, `warranty-apply warranty.json
  --approved --only=w0735191` creates the work order (Reference = the warranty
  number), with a job on New Home at the exact time.
- **Marked special in ServiceMonster:** red job colour (`colorOverride`), plus an
  admin note and job note "WARRANTY - TIMED: arrive at 10:00 AM sharp". The
  arrival-window field doesn't save through the API, so the note carries the time.
- The calendar activity stays. Keith deletes it if he doesn't want both.

The truck starts and ends every day at **53 Umbach Rd, Stony Plain** (from the
ServiceMonster site there).

The helper re-checks duplicates and the slot immediately before creating anything,
and stops if its control search (PO 02210518 -> WO 45769) fails.

Run by hand in a Claude cloud session with the ServiceMonster login saved:

    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/rosa/jayman-sm.mjs check plan.json
