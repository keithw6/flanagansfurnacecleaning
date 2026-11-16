# Home Pros Arcade: the storefront booking game

The customer walks up to the Home Pros shop on a rainy night street, presses Start,
and walks in. Hank greets them from behind the counter. The menu board on the wall
lights up with services and prices, and Hank asks a few click-to-answer questions.
Each answer rings the register and updates the running total. They get a flat-rate
receipt, enter their details, pick an open time from the live calendar, and they're
booked. ServiceMonster emails the customer, and you get an email too.

The street, the shop and Hank are pixel-art images generated with Higgsfield (`img/`).
The code adds the moving parts on top: rain, the door opening and the camera pushing
inside, Hank's mouth while he talks, his celebration, flickering lights and confetti.
Sound is chiptune made in code with WebAudio, so there are no audio files.

```
index.html            the page
css/arcade.css        the look
js/config.js          << EDIT THIS: prices, questions, Hank's lines, hours, API address
js/pricing.js         the flat-rate calculator (shared with the server)
js/schedule.js        finds open time slots (shared with the server)
img/                  street.webp, shop.webp, hank-idle/talk/happy.webp (Higgsfield art)
js/scene.js           layers the art and animates it
js/audio.js           sound effects and shop music
js/api.js             talks to the booking server, or fakes it in demo mode
js/app.js             the conversation flow
worker/               the booking server (Cloudflare Worker) that holds the API key
build-single.mjs      builds dist/home-pros-arcade.html, a one-file copy
```

## 1. Prices, questions and travel

Everything is in `js/config.js`, under `prices`, `travel` and `lines`.

**Prices (before GST):** first furnace $345 (furnace, all ducting, every supply and
return register), each additional furnace $150, each air conditioner $60, a zone
system $60, and a dryer vent $60 (side wall only, added to a furnace cleaning).

**What Hank asks, in order:**
1. Where's the house? (the 7 service-area towns, or "Somewhere else", where they type a town or address)
2. Do you have just one furnace? If no: how many in total?
3. Do you have air conditioning? If yes and more than one furnace: how many air conditioners?
4. Do you have a zone system? ("What's a zone system?" gets: one furnace but more than one thermostat?)
5. Want the dryer vent cleaned too? If yes: side of the house or roof? Roof means no
   dryer vent: we don't go on roofs.

**Travel:** free in Edmonton, St. Albert, Sherwood Park, Spruce Grove, Stony Plain,
Leduc and Fort Saskatchewan. Anywhere else is measured from the edge of the nearest of
those towns, round trip, with roads taken as 1.25x the straight-line distance. The
first 30 km are free and every km after that is $1.50. `js/travel.js` knows about 40
nearby towns. For any other address the booking server looks it up on OpenStreetMap.
If it can't be found, the quote says "travel to be confirmed" and the job note tells
you to call the customer. The server prices travel from the town on the booking form,
so changing the town there updates the price before they pick a time.

## 2. Play it in demo mode

With `apiBase: ''` the game runs in **demo mode**: the calendar shows made-up
openings and booking does nothing. A red DEMO MODE tag sits in the corner. Open
`index.html` in a browser, or `dist/home-pros-arcade.html`.

## 3. Connect ServiceMonster (the booking server)

The ServiceMonster API key can't go in the website. Anyone could read it from the
page. It lives in a small Cloudflare Worker (free tier is plenty):

1. In ServiceMonster (admin login), create an API key/token.
2. Find the route(s) to book onto: `GET https://api.servicemonster.net/v1/routes`
   with header `Authorization: Basic <token>`. Copy the `routeID` GUIDs.
3. Install Wrangler (`npm i -g wrangler`), then from `worker/`:
   ```
   wrangler login
   wrangler secret put SM_API_TOKEN      # paste the token
   wrangler secret put RESEND_API_KEY    # optional, for your manager email
   ```
4. In `worker/wrangler.toml` fill in `SM_ROUTE_IDS`, `MANAGER_EMAIL`, `FROM_EMAIL`,
   and check `ALLOWED_ORIGINS`.
5. `wrangler deploy`. Visit `https://<your-worker>/api/health`: it should say
   `"configured": true` and the number of routes.
6. Put that worker address in `js/config.js` as `apiBase`, rebuild, and redeploy the game.

### What the server does

- **Open times:** `GET /v1/scheduling` for the next few weeks, then every arrival
  window that doesn't overlap an existing job on at least one of your routes, with
  enough room for the job's length.
- **Booking:** re-prices the job and re-checks the time itself. It never trusts the
  browser. Then it makes one `POST /v1/webleads` call with `selectedTime`, `routeID`
  and `duration`. ServiceMonster creates the customer, the order and the scheduled
  job together. The full quote breakdown goes in the job note. `notifyClient: true`
  makes ServiceMonster email the customer.
- **Your notification:** ServiceMonster's own new-web-lead notification tells you about each booking, the same as its web form. Optionally, the server can also send its own email to `MANAGER_EMAIL` with the
  customer's details, the time and the quote. Reply-to is the customer.

### Check these once with your real account

- The customer email ServiceMonster sends for a web lead uses your ServiceMonster
  email templates. Look at it once and set the wording there.
- Book one test job, look at it in ServiceMonster, and confirm the route, time,
  length and note landed where you expect. Then delete it.
- If double bookings matter at your volume, keep one route per truck in `SM_ROUTE_IDS`.
  The server re-checks the slot just before booking. Two customers grabbing the same
  slot in the same second is still possible, though unlikely.

### Test booking

`worker/test-booking.mjs` makes one real booking the same way the server does, with
the customer named "TEST Arcade Booking - DELETE ME". Run it without `--book` first
to see the route and time it picked. Add `--after YYYY-MM-DD` to keep the test off
the next few days. In a Claude cloud session with the ServiceMonster login saved as a
network secret, run it as
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt SM_API_TOKEN=proxy-injected node test-booking.mjs`.

### One truck, two routes

Online bookings go onto **Edmonton Residential** (`SM_ROUTE_IDS` in
`worker/wrangler.toml`). The same truck also does **New Home** jobs, so that route is
listed in `SM_BLOCKING_ROUTE_IDS`. A time is only offered when neither route has a job
then. Finished jobs still count as busy, and cancelled jobs don't. When you add a second
truck, give it its own booking route.

## 4. Put it on homeprosgroup.com

Host the folder (or the single `dist/home-pros-arcade.html`) anywhere static: the
same GitHub Pages site, Netlify, Cloudflare Pages, or your current host. Then link to
it from a "Book Online" button, or embed it on a page:

```html
<iframe src="https://homeprosgroup.com/book/" style="width:100%;height:100vh;border:0" title="Book with Home Pros"></iframe>
```

Rebuild the single file after any edit: `node tools/home-pros-arcade/build-single.mjs`.

## The back office (Staff Only door)

Behind Hank's counter is a door marked STAFF ONLY. Click it, enter the owner password,
and you see the head office from above: a hallway with six offices off it and the
boardroom at the end.

- **Offices:** General Manager (Grace), Accounting (Penny), Marketing (Max), Email
  Manager (Eddie), Customer Service (Rosa), and your own Chief Human Officer office.
- **Everyday:** everyone stays at their desk. They only get up when they have
  something to do with someone else (Rosa walks the booking report to Grace when a
  day is overbooked) or when you call a board meeting. You (Keith) walk in from the
  shop door to your desk. Click a person or their office to talk to them.
- **Customer Service desk** (click Rosa, her office, or the "Customer Service desk"
  button) has three reports for the next 14 days: **Jayman bookings** (New Home
  route), **Booking % by route**, and **Total booking %** for the one truck. A full
  day is 8 hours (4 calls x 2 h), so a day can show over 100%. Waterfront Pointe's
  all-day jobs push Nov 24, 25 and 27 to 200%, 150% and 125%. Those days are marked
  OVERBOOKED, and the jobs stay where they are.
- **Rosa's questions:** when her morning run leaves questions (warranty work orders,
  new bookings to approve, better driving orders), clicking Rosa opens them first. Tap
  your answers and press Send: the reply is copied and her booking-desk session opens,
  where you paste it. The arcade itself never changes ServiceMonster. Held orders are
  listed too. Refresh with `office-snapshot.mjs --inbox=<folder with her warranty.json
  and plan-checked.json> --session=<her session link>`.
- The preview shows a snapshot (`js/office-data.js`, refresh with
  `tools/rosa/office-snapshot.mjs`). The live site reads ServiceMonster through the
  booking server's `/api/office/report`, which needs your owner login.
- **Board meeting:** "Call a board meeting" sends everyone, you included, to an
  assigned boardroom seat. You sit at the head, Grace, Penny and Max on the far side,
  Eddie and Rosa on the near side, with one spare seat. "Adjourn" sends them back.
- Click anyone (hover shows their name) to see what they handle. The TO SHOP door on
  the left goes back to Hank. The directors are not connected to real data yet.
- Each character has four views (facing you, left, right, walking away) and turns to
  face the way they walk. They are drawn as bobbleheads: bigger head, smaller body,
  a little head wobble. Furniture is drawn back to front, so people sit in their
  chairs, behind desks, and at the boardroom table.

- Names, titles, lines, duties, offices (`home`) and seats (`seat`) are in `js/config.js` under `owner` and `directors`.
- Walking routes, desks and seats for the floor plan are at the top of the office section in `js/scene.js` (`PLACES`).
- Character art is `img/dir-<id>.webp`: four 220x440 frames side by side.
- Login: the booking server checks `OWNER_PASSWORD` and hands back a signed pass
  (`SESSION_SECRET`) that lasts 12 hours. Set both with `wrangler secret put`. In demo
  mode any password opens the door, and the page says so. The password is never in
  the page itself.

## Changing the art

All five pictures are in `img/`. You can swap any of them for another image the same
size: 1344x752 for the street and shop, square with a transparent background for
Hank. If the new shop picture moves the menu board, counter or register, adjust the
positions at the top of `js/scene.js` (`DOOR`, `HANK`, `COUNTER_TOP`) and the
`.board`, `.register` and `.counter-text` boxes in `css/arcade.css`. The talking
frame is the idle picture with only the mouth swapped in, so Hank's head doesn't
jump when he talks. Keep that if you regenerate him.

## Accessibility and phones

Everything works by tap, mouse or keyboard. Number keys pick answers, Enter/Space
skip Hank's typing, and Esc goes back. Sound starts muted until the customer presses
Start, and there's a mute button. With "reduce motion" turned on, the rain, typing
and animations are turned off. It fits phone screens with no sideways scrolling.

## How we clean (on the counter)

The "HOW WE CLEAN" brochure stand on the counter (and "How do you clean my ducts?" in
Hank's menu) opens the seven-step Our Process section from homeprosgroup.com: the
animated house diagram, play/pause and tap-a-step. `process/extract.py` copies it from
the live page into `js/process.js` (and a standalone `process/our-process.html`).
Re-run it after the section changes on the website.
