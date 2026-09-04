# The 20-Year Test

An interactive career and business comparison calculator for Blue Collar Business.

It answers one question: **if two people start at the same age, which career leaves
them better off twenty years later** — counting money, time, debt, lifestyle,
ownership and scalability, not just salary.

Open `index.html`. No build step, no server, no dependencies. It works from the
file system by double-click and it works on GitHub Pages.

```
tools/20-year-test/
  index.html          page shell and tab structure
  css/app.css         theme-aware stylesheet, including the print/PDF layout
  js/presets.js       career presets, tax tables, scenarios - the data layer
  js/engine.js        the year-by-year simulation
  js/scoring.js       lifestyle, BCB 100, the four /10 scores, dependency, confidence
  js/charts.js        hand-rolled SVG charts
  js/narrative.js     the written analysis and the YouTube pack
  js/app.js           form generation, rendering, the printable report
  js/studio.js        the recording rig - stage, prompter window, webcam
  build-single.mjs    bundles all of the above into one self-contained file
```

## How to use it

1. **Setup** — pick a matchup or two careers, set the period and the assumptions,
   then edit anything. Every input the engine reads is on this tab.
2. **Results** — the head start, wealth at year 20, winner by category, all three
   scenarios, employee-versus-owner, and the year-by-year table.
3. **Charts** — eight comparisons built to be read off a screen recording.
4. **Scores** — the Blue Collar Business 100, the four ownership scores, time
   freedom, owner dependency, lifestyle, each with its components shown.
5. **Analysis** — the written explanation of *why* the numbers came out that way.
6. **YouTube** — five titles, thumbnail text, an opening hook, key results, verdict.
7. **Report / PDF** — twenty-five sections. Print to PDF from the browser.
8. **Studio** — the recording rig. See below.

Save keeps the comparison in this browser. Export writes a JSON file you can keep
or hand to someone else.

## Recording an episode

The Studio tab turns the comparison into an episode: seventeen beats, roughly
seven minutes of narration, generated from the numbers currently on screen.

**Three pieces, deliberately kept apart:**

- **The stage** — full-bleed slides in this window. This is what you capture.
  Beats advance on a timer sized to each script block, and space, the arrow keys
  and the on-screen controls always override the timer. The controls fade after a
  couple of seconds so they stay out of the recording.
- **The prompter** — a *separate window*, because an overlay is inside the thing
  you are recording. Its reading line is pinned near the top of the window, which
  is the whole point: on a monitor with the webcam above it, a high reading line
  puts your eyeline close to the lens, so you look like you are talking to camera
  rather than reading off to one side. A dashed mark shows exactly where that line
  is — align it under your lens, then it fades once you start rolling.
- **The camera** — picture-in-picture over the slides, so a single window capture
  carries both. Draggable, resizable, circle or rounded, mirrored or not.

**On one wide screen:** put the slide window on the half you are capturing and the
prompter on the half your webcam sits above. Raise or lower the reading line with
the up and down arrows until the mark sits just below the lens. Keep the prompter
column narrow — the default is 26em — so your eyes barely track sideways.

**Keys while presenting:** space play/pause · ← → beat · ↑ ↓ reading line ·
C camera · F fullscreen · Esc leave.

The script is editable. Every beat is a text area, one sentence per line, and the
timings recalculate from what you type at about 155 words a minute. "Regenerate
from the numbers" rebuilds it and discards your edits.

**This part needs the local copy.** A page embedded in another site is normally
refused camera access outright and cannot open windows, so the camera and the
pop-out prompter will not work in a hosted copy. Open `index.html` (or the bundled
`dist/20-year-test.html`) from your own machine to record.

## How the model works

One pass per career, one row per year of life. Every downstream view reads those
rows. Money is nominal — dollars of the year they occur in — with the
today's-dollar equivalent reported alongside so a twenty-year figure is not read
too generously. Tax brackets, living costs and house prices are all indexed to
inflation.

**Business profit is built up from labour rather than typed in.** Materials, then
producing employees at a fully loaded cost against the revenue each generates,
then the owner's own billable capacity, then overhead. Margin comes out as a
result. This matters for two reasons: typed-in margins gave a solo operator less
than journeyperson wages at one end and a negative margin at scale at the other,
and the build-up makes **owner dependency a measurement instead of an opinion**.
If you have a real P&L in front of you, switch the business to direct-margin mode
and type your own.

Two guards keep it honest rather than merely stable:

- **An owner steps back from production only as far as the business can support.**
  If handing the work to employees would not cover the equipment, the bank and a
  liveable draw, the owner stays in the chair. This is why the default dentist
  cannot step back for six straight years — and it is the single most useful thing
  the model says.
- **A manager gets hired when the owner actually hands the work over,** not on a
  birthday. Paying for a manager you are not yet using bankrupts otherwise sound
  businesses.

A business that loses money with the owner already flat out winds up rather than
borrowing forever, and the report says so.

Financial-freedom and debt-free ages usually fall outside a twenty-year window, so
the same model runs on to age 75 and anything past the window is labelled a
projection. Freedom is reported two ways — keeping the business and selling it —
because those are different lives.

## What it does not do

- It does not price the chance of a business failing. It shows what happens if the
  business works, except where the numbers stop working on their own.
- Tax is simplified: federal and provincial or state brackets, payroll
  contributions and a registered-savings deduction. No credits, no spouse, no
  dependants, no capital-gains treatment on a sale.
- Investment returns are a smooth annual rate. Real markets are not smooth, and
  the order the returns arrive in matters.
- It is not financial, tax, career or investment advice.

## About the preset figures

Every number in `presets.js` is a **starting estimate, not a verified fact**, and
each carries a tag: Verified, Industry average, User supplied or Estimated.
Presets ship as Industry average or Estimated. **Nothing ships as Verified.** They
are typical published ranges for each trade and profession, not values taken from
a single citable study, and the tool labels them that way on purpose.

Replace anything that matters with a local number you can defend on camera, and
mark it Verified once you have the document. The data-confidence panel rolls the
tags up and is deliberately unforgiving: a comparison is only as good as its
weakest important input.

## Intellectual honesty

From the brief, and worth restating because it is the whole point: the objective
is **not** to promote blue-collar careers at the expense of professional ones. If
the dentist wins, the tool says the dentist wins. Where a result is uncomfortable
for the trades — the owner-operator trucker's business is a good example — it says
that too. Never adjust the assumptions to make a preferred career win; adjust them
to match what you actually know, then report what comes out.

## Relationship to the rest of this repository

This tool is self-contained and deliberately outside `_src/build.ps1`. That
generator exists to keep the `LocalBusiness` schema and NAP identical across the
35 pages of the Flanagan's site; it has nothing to offer an interactive app, and
routing this through it would only put the app's fate in the hands of a template
built for a different job. Nothing here is linked from the site, and the page
carries `noindex, nofollow`.
