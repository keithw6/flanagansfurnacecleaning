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

The helper re-checks duplicates and the slot immediately before creating anything,
and stops if its control search (PO 02210518 -> WO 45769) fails.

Run by hand in a Claude cloud session with the ServiceMonster login saved:

    NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/rosa/jayman-sm.mjs check plan.json
