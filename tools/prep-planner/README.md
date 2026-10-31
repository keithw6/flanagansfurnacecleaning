# Prep Planner: Household Command

A household emergency preparedness planner for Stony Plain / Parkland County.
Open `index.html`, or the single file `dist/prep-planner.html`. No build step, no
server, no account, no dependencies. Everything you enter stays in the browser on
that device.

## What it does

| Tab | What it is for |
|---|---|
| **Command** | Readiness score, critical items, water and food in days, budget, expiry alerts, the top 5 gaps, and a live **stay-or-go decision check** |
| **Profile** | The household profile. Every other tab reads from it: quantities, gaps, verdicts and plans |
| **Purchases** | The purchase tracker: target (worked out from the profile, can be overridden), have, cost, spent, expiry date and store for every item |
| **Shopping list** | Everything still short of target, **grouped by store**, with a "Bought" button that updates the tracker and spending |
| **Checklists** | Editable checklists: go-bag, warm room, home hardening, vehicle kit, comms, maintenance, drills |
| **Scenario report** | Builds a full plan for any of the 13 scenarios, then prints to PDF |
| **Suppliers** | The Local Suppliers Directory: where you buy food, medicine, fuel, radios and security gear. Linked to the shopping list |
| **Community** | Official resources: 911/811/211/511, Alberta Emergency Alert, Town and County emergency management, reception centres, the food bank |
| **Backup** | Export and import a JSON backup; reset |

## The rules it applies

Stay home by default. The decision matrix, the decision check and every plan follow
the same rules:

- **Extreme cold:** a cold house beats a road. Leave only if the home cannot be heated
  at all, a heated destination is confirmed, and it can be reached in one daylight leg.
- **Nuclear:** get in, stay in, centre of the basement, 24–48 hours minimum (7-10 rule).
  KI only on official instruction.
- **Grid down / collapse:** a short golden window (0–24 h) for a pre-arranged retreat,
  then go quiet and go low, reassessing at day 3, week 2, week 4 and week 8.
- **Wildfire, derailment, chemical spill:** the exceptions. Leave early and fast when
  ordered or when the threat is visible; seal a room if told to shelter in place.

Each plan has 24 sections (summary, warning signs, decision matrix, first 60 minutes,
72 hours, weeks 1–4, long term, shelter-in-place, bug-out, supply list, comms,
medical, cold-weather modifier, threats, OPSEC, hardening, community, de-escalation,
legal, roles, drills, local resources, top 5 gaps) and a one-page quick-reference card
on its own final page. Profile fields that are still empty are listed as assumptions
on the cover.

## Printing and PDF

Use **Print / save PDF** on the Scenario report tab and choose "Save as PDF". The
print layout has a title page, contents, page numbers, real tables, checkbox lists,
and the quick-reference card on a separate page for the fridge or go-bag. The
shopping list, checklists, tracker, suppliers and community tabs each print on
their own too.

## Offline

- Served over http(s) (e.g. GitHub Pages), a service worker caches the app after the
  first visit, so it opens with no connection. It can be installed to a phone's home
  screen.
- `dist/prep-planner.html` is the whole app in one file. Put it on a USB stick or a
  phone and open it in any browser; it needs nothing else. Import a backup to bring
  your data across.
- Print the plans anyway. Paper works when batteries do not.

## Data you should check

- Prices are approximate 2026 CAD planning figures, not quotes.
- The supplier entries are generic starting points ("Pharmacy (nearest)"). Replace
  them with your actual stores, addresses and hours.
- Community resources marked **Verify number** need confirming against the Town,
  County or your utility bill. The short codes (911, 811, 211, 511) are province-wide.
- Your household data never goes into this repository: it lives only in the
  browser's local storage and in backups you export.

## Files

```
tools/prep-planner/
  index.html            page shell and tabs
  css/app.css           light/dark theme and the print/PDF layout
  js/scenarios.js       the 13 scenarios, the decision matrix, the decision rule engine
  js/catalog.js         supply catalogue, starter suppliers, community resources, checklists
  js/store.js           saved state, quantities from the profile, progress, budget, gaps
  js/report.js          the scenario plan generator
  js/app.js             rendering and interaction
  sw.js                 offline cache (bump VERSION when files change)
  manifest.webmanifest  install-to-home-screen
  build-single.mjs      bundles everything into dist/prep-planner.html
```

Rebuild the single file after any change:

```
node tools/prep-planner/build-single.mjs
```
