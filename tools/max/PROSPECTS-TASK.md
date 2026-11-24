# Max · daily: contact list and post drafts

Max runs this once a day (scheduled task "Max · 11:23 AM · Contact list and post drafts").
It does two things and touches nothing else: it adds contacts to the list, and it keeps a few
social post drafts ready for Keith. It never sends email, never posts anything, never messages
anyone, and never changes ServiceMonster.

The arcade is the artifact https://claude.ai/artifact/UzjFfo9KUmPYRwdU25ieFS. Use the ArtifactData
tool with that url. Docs: `eddie/prospects` and `eddie/posts`. Pin `if_version` to the version you
read on every write; omit it only when creating a doc. Keith can change both docs from Max's desk
in the arcade at any time, so read each doc right before you write it and never drop his changes.

## Part 1: the contact list (eddie/prospects)

Doc shape:

```
{
  "contacts": [ {"id", "type": "pm" | "agent", "name", "company", "phone", "email", "area", "source", "addedAt"} ],
  "removed":  [ lowercase emails and 10-digit phones Keith removed: never add these again ],
  "done":     [ short keys of searches already worked, e.g. "pm|St. Albert", "agent|Sherwood Park|RE/MAX" ],
  "lastRun":  {"date": "YYYY-MM-DD", "added": n, "areas": "St. Albert, Morinville", "note": "one short line"}
}
```

Keith's rules (do not bend these):

- **Only these fields:** the person's name, their company or brokerage, their business phone, their
  business email, and the general area they serve. Nothing else: no home addresses, no photos, no
  listings, no prices, no social profiles, no notes about them.
- **Never copy listings.** Don't open or record property listings, MLS numbers or listing details.
  Don't take anything from REALTOR.ca, MLS or listing pages. Use the person's or company's own
  public business page, their brokerage's team page, or a business directory entry they published.
- **Published business contact details only.** Only add a phone or email that the person or company
  published for business. Skip anyone whose page says they don't want unsolicited email, and skip
  personal-looking emails unless the person publishes them as their business contact (many agents
  do use gmail for business: that is fine when it's on their own business page).
- **No LinkedIn.** Don't collect anything from LinkedIn.
- **Never guess.** If a phone or email isn't shown in a source, leave it empty. Never build an
  email from a pattern (like first.last@company.ca). A contact needs at least a phone or an email.
- `source` is the URL where you saw the details (for Keith to check). One URL.

How to work:

1. Read `eddie/prospects` (create it as `{"contacts":[],"removed":[],"done":[]}` if it doesn't exist).
1b. **DIG FOR DIRECT EMAILS FIRST (every run, before adding new people).** Keith wants each
   agent's and property manager's own email (jane.smith@remax.ca, jsmith@gmail.com on her own
   business page), not just the office's general inbox (info@, admin@, office@, reception@,
   rentals@, contact@, hello@). Go through the existing list, oldest first, up to **25 contacts
   per run**, skipping any whose `emailCheckedAt` is under 30 days old:
   - **A person with no email, or only a general inbox:** search for their own published email:
     `"First Last" realtor email`, `"First Last" brokerage name`, `"First Last" property manager
     Edmonton email`, their team or brokerage profile page, their own website's contact page,
     their Facebook business page "About", Google Business listing, the brokerage roster page,
     RECA-listed brokerage pages and local directories (chamber of commerce, BBB). Open the pages
     with WebFetch when this environment allows the host.
   - **A company-only entry (property management firm, brokerage office):** look for its team or
     staff page and add each named property manager or agent who has their OWN published email
     or direct phone, as a new contact (same company, their own name), keeping the company row.
   - Put the person's own email in `email`; keep a general inbox in `officeEmail` when you
     replace it. Set `emailType` = "direct" (a named person's own address) or "general".
     Set `emailCheckedAt` = now on every contact you checked, found or not, and `source` to the
     page that shows the address.
   - Same rules as always: only addresses actually published by the person or their business
     for business contact (own site, brokerage profile, business listing). Never guess or build
     one from a pattern (first.last@...), never copy from data-broker or "email finder" sites,
     never from LinkedIn, REALTOR.ca or listings.
   Report how many direct emails you found in `lastRun.emails` (e.g. "found 9 of 25 checked").
2. Pick today's areas. Start with the greater Edmonton area and work outward, finishing an area for
   both types before moving on, in this order: Edmonton (west, south, north, central, then east),
   St. Albert, Sherwood Park / Strathcona County, Spruce Grove, Stony Plain / Parkland County,
   Leduc, Beaumont, Fort Saskatchewan, Devon, Morinville, Gibbons, Nisku, Acheson.
   Keith will say when to go further out (Red Deer, Camrose, Wetaskiwin, Westlock and so on).
   Use `done` to see where you left off.
3. Then add **about 15 new contacts** (fewer when the email digging took the run's time), always
   trying for the person's own email as in 1b: roughly half property managers (residential rental and
   condo management companies, and their individual property managers when the company lists
   them), half real estate agents (brokerage team pages: RE/MAX, Royal LePage, Century 21,
   eXp, Realty Executives, Coldwell Banker, Sotheby's, independents).
4. Use WebSearch (standard mode first; extended only when standard comes back thin). Many company
   websites can't be opened from this environment: if WebFetch fails on a host, don't keep trying
   other hosts with it; use the search results. Only record details that the search result or page
   shows for that person or company.
5. Skip duplicates: same email (any case) or same 10-digit phone as a contact already on the list,
   or in `removed`. For a company with one main line, add the company once (name = company name,
   company empty is fine) and then individual managers or agents only when they have their own
   phone or email.
6. `area` is the general area they serve, short: "Edmonton", "Edmonton & St. Albert",
   "Spruce Grove & Stony Plain", "Greater Edmonton". `id` = a short unique string
   (e.g. base36 time plus 3 random characters). `addedAt` = now (ISO).
7. Write the doc back with the new contacts appended, `done` updated and `lastRun` set.
   If WebSearch doesn't work at all, write `lastRun` with added 0 and the note saying what failed.

## Part 2: post drafts (eddie/posts)

Doc shape: `{"posts": [ {"id", "network": "facebook" | "hpg-linkedin" | "keith-linkedin", "text", "photo", "status": "draft" | "posted" | "skipped", "createdAt", "doneAt", "edited"} ]}`

1. Read `eddie/posts` (create `{"posts":[]}` if missing).
2. For each network, count drafts with status "draft". Write new drafts only to bring each
   network up to **3 waiting** (Facebook, Home Pros LinkedIn) and **2 waiting** (Keith's
   personal LinkedIn). If Keith hasn't posted or skipped anything in 14 days, don't add more.
3. Learn from Keith: posts he marked "posted" (especially with `edited: true`, where he changed the
   text) show the tone and length he likes; "skipped" ones show what he doesn't. Don't repeat a
   topic used in the last 30 days.
4. Who's talking:
   - **facebook** (Home Pros Group page): homeowners in the Edmonton area. Friendly, plain, short
     (40 to 90 words), one clear point, a soft call to action ("Book online at homeprosgroup.com or
     call 780-932-7337"). Up to 2 emojis and 3 local hashtags (#yeg #Edmonton #StAlbert ...).
   - **hpg-linkedin** (Home Pros Group company page): property managers, realtors, builders and
     condo boards. Professional, 60 to 140 words: tenant comfort, maintenance schedules, move-in /
     move-out cleans, pre-listing and new-construction cleans, reliable booking, invoices on account.
   - **keith-linkedin** (Keith's personal account, in his voice, first person): an owner's view of
     the trade, lessons from jobs, the team, local business. 60 to 150 words. No hard selling.
5. Topics to rotate: seasonal timing (furnace season, spring A/C, allergy season, wildfire smoke,
   renovation dust), what a proper duct clean involves, signs ducts need cleaning, new-home
   construction dust, dryer vent fire safety (side-wall vents only: we don't go on residential
   roofs), filters, a recent kind of job (never a customer's name or address), reviews (no names
   unless public on Google), the free-travel towns (Edmonton, St. Albert, Sherwood Park,
   Spruce Grove, Stony Plain, Leduc, Fort Saskatchewan).
6. Facts must be true: Home Pros Group, furnace and duct cleaning, Edmonton area, 780-932-7337,
   homeprosgroup.com. Prices only from the price list (first furnace $345, each extra furnace $150,
   A/C coil $60, plus GST) and only now and then. Never invent awards, years in business, numbers of
   customers, discounts or promotions. No health claims beyond "can help reduce dust".
7. `photo`: one short line suggesting a picture Keith could add (e.g. "before/after of a return
   vent"), or empty.
8. Append the new drafts (status "draft", createdAt now) and write the doc. Keep at most the 60
   newest posts that are posted or skipped; never remove drafts.

## Report

Send Keith one short push notification: "Max: [n] contacts added today ([areas]), [total] on the
list. [p] post drafts waiting on my desk in the arcade." Say the same in this session, then stop.
Do not commit or push anything.
