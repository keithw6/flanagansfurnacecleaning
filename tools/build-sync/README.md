# Build Sync

A shared site-and-trade board for a new-home builder's project manager and every
trade on their homes. It is published as a claude.ai Artifact, which gives it a
shared live database, sign-in, and photo uploads. `build-sync.html` is the page
source. Opened as a plain local file it runs in **preview mode** with sample data
held only in that browser tab.

## What it does

| View | For | What it shows |
|---|---|---|
| **Today** | PM | Jobs on site, jobs on hold, notices nobody has acknowledged (with phone number and a ready-to-send text), past-due jobs not marked done, unconfirmed jobs for today and tomorrow |
| **Homes** | PM | Every home with phase, % done, possession countdown, holds, delays, deficiencies |
| **Home** | Everyone | The full schedule by phase, GO / WAIT / HOLD per job, photos, deficiencies, history |
| **Lookahead** | PM, trades | 14 days of jobs, filtered by community, trade, or problems only |
| **My jobs** | Trades | Pick your company once. Your notices, your jobs with GO / HOLD, confirm, on site, done, report a delay, add photos, your deficiencies |
| **Playbook** | PM | ~90 ideas for cutting PM time, the live ones marked |
| **Setup** | PM | Trade companies, adding homes, sharing steps, sample data |

## The rule it applies

Every job lists the jobs it depends on (duct cleaning depends on hardwood). A job is:

- **GO** when everything before it is marked done
- **WAIT** when everything before it is scheduled to finish in time
- **HOLD** when something before it is delayed with no date, overlaps it, or was due
  and never marked done
- **MOVED** after a reschedule, until the trade confirms the new date

Report a delay and the board previews exactly which downstream jobs move or go on
hold, then sends each affected company a notice that stays red until they tap
**Got it**.

## Limits of this version

- Notices live inside the board. Real SMS / email needs a backend with a messaging
  service; for now the Today page gives the PM a copyable text and the phone number.
- People must be shared on the Artifact as **Contributors** to make changes.
  Photo uploads from Contributors depend on the organization's setting, and their
  photos are only visible to signed-in members of the owner's organization.
- The 38-job template is a generic Alberta single-family sequence. Edit durations and
  dependencies in `TEMPLATE` near the top of the script.
