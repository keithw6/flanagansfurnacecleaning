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

## 1. Set your prices

Open `js/config.js`. **Every price in it is a sample.** Change:

- `menuBoard`: what's painted on the wall.
- `services.furnace.questions` / `services.dryer.questions`: the calculator. Each
  answer has a `price` (and optional `hours`, which adds job time on the schedule).
  The first question's answer is the base price; later answers are add-ons.
- `bundle.dryerWithFurnace`: the dryer vent price when booked with a duct clean.
- `business.phone`: shows a "Call us" button when something goes wrong.
- `schedule`: work days, arrival windows, how far ahead, minimum notice.

The game and the server both read this file, so the server always books the price
the customer saw.

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
- **Your email:** sent through Resend (free tier) to `MANAGER_EMAIL` with the
  customer's details, the time and the quote. Reply-to is the customer.

### Check these once with your real account

- The customer email ServiceMonster sends for a web lead uses your ServiceMonster
  email templates. Look at it once and set the wording there.
- Book one test job, look at it in ServiceMonster, and confirm the route, time,
  length and note landed where you expect. Then delete it.
- If double bookings matter at your volume, keep one route per truck in `SM_ROUTE_IDS`.
  The server re-checks the slot just before booking. Two customers grabbing the same
  slot in the same second is still possible, though unlikely.

## 4. Put it on homeprosgroup.com

Host the folder (or the single `dist/home-pros-arcade.html`) anywhere static: the
same GitHub Pages site, Netlify, Cloudflare Pages, or your current host. Then link to
it from a "Book Online" button, or embed it on a page:

```html
<iframe src="https://homeprosgroup.com/book/" style="width:100%;height:100vh;border:0" title="Book with Home Pros"></iframe>
```

Rebuild the single file after any edit: `node tools/home-pros-arcade/build-single.mjs`.

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
