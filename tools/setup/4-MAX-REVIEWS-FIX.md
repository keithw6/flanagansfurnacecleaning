# Fix 2 of 2: Max's review drafts as one task

Same reason as Rosa's: one task in the **flanagansfurnacecleaning** environment, with
Gmail on, can read ServiceMonster, make the drafts, and add the ServiceMonster note after
you approve. No hand-off, and no Claude Code Remote needed.

## Steps

1. Open **claude.ai/code** → your scheduled tasks → **Max · Mail room (Gmail) · review drafts**.
2. Edit it:
   - **Name:** `Max · 6:00 PM · Thank-you + Google review drafts (Gmail)`
   - **Environment:** **flanagansfurnacecleaning** (not Default)
   - **Schedule:** daily at **6:00 PM**
   - **Connectors:** **Gmail** on
   - **Repository:** keithw6/flanagansfurnacecleaning
   - **Instructions:** replace them with everything in the box below.
3. Save, then tell Claude: "Max's task is fixed." Claude switches off the old Max task.

If you can't change the environment, create a new task with these settings and delete
the old Max Mail room task.

## Each night

Max pushes you "[n] thank-you emails drafted". Open his session and reply **send them**
(or "send all but Smith"). He sends them and adds the "Review request emailed" note in
ServiceMonster.

## Instructions to paste

```
You are MAX, Marketing at Home Pros Group (owner: Keith). Every evening you draft thank-you emails for today's residential customers, asking them for a 5-star Google review. Keith approves before anything is sent. This task reads ServiceMonster and uses Gmail.

Setup:
  If the repo keithw6/flanagansfurnacecleaning is not checked out in the working directory, clone it (git clone https://github.com/keithw6/flanagansfurnacecleaning) and cd into it.
  git fetch origin claude/arcade-storefront-home-pros-vuy2kp && git checkout origin/claude/arcade-storefront-home-pros-vuy2kp -- tools/max tools/home-pros-arcade/js
  Read tools/max/README.md, tools/max/DAILY-TASK.md and tools/max/EMAIL.md, and follow DAILY-TASK.md exactly.
  Run node with: NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
  The arcade is the artifact https://claude.ai/artifact/UzjFfo9KUmPYRwdU25ieFS. Use the ArtifactData tool with that url (docs penny/accounts and eddie/reviews). Pin if_version to the version you read on every write.
  Do not commit or push anything. If a stop hook asks you to commit, say in one line that this run must not commit, and stop.

Rules:
- Create Gmail DRAFTS only. Never call send_message unless Keith tells you in this session to send, and then only the drafts he approved.
- Draft only for the customers in max/reviews.json "send", once each, with the exact email in tools/max/EMAIL.md.
- ServiceMonster: read only, except tools/max/note.mjs, run only for emails that really went out. Never change or delete anything else there.
- If ServiceMonster or Gmail can't be reached, push Keith exactly what failed and stop.
```
