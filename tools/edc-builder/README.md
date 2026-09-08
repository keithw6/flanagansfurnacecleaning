# EDC Builder

Pick everyday-carry gear from every category, lay it out on a display board at
true relative scale, and see what the whole kit costs and weighs. Put your name
and a profile link under it, and send the board to anyone as a link.

Open `index.html`. No build step, no server, no dependencies. It works from the
file system by double-click and it works on GitHub Pages.

```
tools/edc-builder/
  index.html          page shell and tab structure
  css/app.css         theme-aware stylesheet, including the print layout
  js/catalog.js       109 products across 19 categories - the data layer
  js/art.js           the drawing generators, one per kind of object
  js/board.js         the display board: layout, surfaces, the SVG itself
  js/share.js         share links, save, import/export, PNG
  js/app.js           the UI - catalogue, pack, board controls, stats
  media/manifest.js   optional per-product image overrides, normally empty
  build-single.mjs    bundles all of the above into one self-contained file
```

## How to use it

1. **Build** — filter or search the catalogue and add things. The sidebar keeps
   a running cost and weight. Six starter loadouts fill the pack in one click if
   you would rather edit than start from nothing.
2. **Board** — pick a layout and a surface, add your name and a profile link,
   then download it as a PNG or print it.
3. **Stats** — where the weight and the money actually went, by category.
4. **Share** — copy the link, save to this browser, or export JSON.

## Why everything is drawn instead of photographed

The obvious way to build this is a folder of product photographs. It does not
work. Ninety photographs carry ninety backgrounds, ninety light directions and
ninety scales, and cutting the backgrounds out fixes only the first of those.
The board still looks like a collage.

So every product is drawn by one of about forty generators in `js/art.js`,
called with that product's colours and proportions. Two knives from different
makers come out looking like two knives photographed on the same table, because
the same function drew them, lit from the same corner, with the same stroke
weight and out of the same palette. Consistency is a property of the code rather
than something anyone has to maintain by hand.

The second reason is scale. Each product declares its real footprint in
millimetres and the knolling layout honours it, so a board holding a Nalgene and
a keychain light shows you honestly how those two compare. That is the single
most useful thing the board does, and no set of product shots gives it to you.

It is also faster, works offline, prints, and does not involve generating
imitations of other people's products.

## The media library

`media/manifest.js` maps a product id to an image, and that image replaces the
drawing everywhere — catalogue card, pack list and board.

```js
window.EDC_MEDIA = {
  'bm535': 'stills/benchmade-bugout.png',       // relative to media/
  'ridgealu': 'https://example.com/ridge.png'   // or an absolute URL
};
```

Empty is the normal state, and nothing here is required. Two things to know
before filling it:

- Cut the background out, shoot square-on, and light from the top left, or the
  image will not sit with the drawings around it. Getting a hundred images to
  agree on those three things is the work the generators exist to avoid.
- An absolute URL to another site taints the canvas, so **Download PNG** will
  then fail with a message saying so. A file inside `media/` does not have that
  problem. Prefer local files.

It is a `.js` file rather than `.json` because a page opened straight off the
disk cannot fetch a local `.json`, and this tool is meant to survive being
double-clicked.

## Sharing without a server

There is no account and no back end. The whole pack — items, name, link, board
settings — is packed into a short record, base64url encoded, and carried in the
URL fragment. The fragment specifically, so it is never sent to whatever is
hosting the page.

Product ids are the share format. **Adding a product is safe; renaming an id
breaks every link anyone has already sent.** Add, never rename.

Anything arriving from a link is treated as written by a stranger, because it
was: ids are looked up rather than trusted, layout and surface names are checked
against the known sets, free text is stripped of control characters and
length-clamped, and a URL has to be `http` or `https` before it goes anywhere
near the document. `js/board.js` re-checks the profile link itself rather than
trusting its caller — `new URL()` will happily parse `javascript:`, so the
protocol has to be tested explicitly.

## About the prices and weights

Every price is typical retail in US dollars and every weight is a published
spec, both recorded by hand and both out of date the moment a maker changes a
run. They are here so items can be compared against each other. They are not a
quote, and the app says so on the Share tab rather than only here.

Each product links to its maker so the current figure can be checked at the
source. **Those links point at maker home pages, not at deep product URLs** —
a deep link that 404s is worse than a shallow one that works, and a product page
slug is exactly the kind of thing that changes quietly. Replacing them with
exact product pages is a one-line edit per item in `js/catalog.js`.

Nothing here is sponsored and no link is an affiliate link. Product names are
the trademarks of their owners and are used to identify the gear.

## Building the single file

```
node tools/edc-builder/build-single.mjs
```

Writes `dist/edc-builder.html`, which is the file to hand to somebody who just
wants to open it, and `dist/artifact.html`, the same page without the outer
document wrapper for hosts that supply their own. Both are checked in for the
same reason `tools/20-year-test/dist/` is: they are generated, but they are also
the thing a non-developer is meant to download.

The bundle inlines everything and makes no network requests at all. One
consequence worth knowing: some embedded contexts block downloads a page starts
itself, so **Download PNG** may do nothing in an iframe host. Print to PDF works
there, and the local copy works everywhere.

## Relationship to the rest of this repository

Self-contained, and deliberately outside `_src/build.ps1`. That generator exists
to keep the `LocalBusiness` schema and NAP identical across the 35 pages of the
Flanagan's site; it has nothing to offer an interactive app. Nothing here is
linked from the site and the page carries `noindex, nofollow`, the same
arrangement as `tools/20-year-test/`.
