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
  js/custom.js        products you add yourself, and the image brief
  js/app.js           the UI - catalogue, pack, board controls, stats
  media/manifest.js   optional per-product image overrides, normally empty
  build-single.mjs    bundles all of the above into one self-contained file
```

## How to use it

1. **Build** — filter or search the catalogue and add things. The sidebar keeps
   a running cost and weight. Six starter loadouts fill the pack in one click if
   you would rather edit than start from nothing. **Add a product you found**
   takes anything that is not in the catalogue — see below.
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

## Adding a product you found

Paste the link, fill in the cost and weight, pick a category, and it joins the
catalogue. It is kept in this browser, it goes on the board, it counts in the
totals, and it can be edited or deleted from **Your products**.

Two things the browser genuinely cannot do, and the form says so rather than
pretending:

- **It cannot read the product page.** A page on another site is not fetchable
  from this one, so the cost and the weight have to be typed in. What it *can*
  read is the URL, and a maker's URL nearly always carries the brand in the
  hostname and the product in the last path segment, so **Read the link** fills
  those two in and leaves them editable. Marketplace SKUs get stripped.
- **It cannot call an image generator.** There is no server and no key, and a
  key in a public page is not a key.

So a picture comes from one of four places:

| Source | What you get |
| --- | --- |
| Nothing (the default) | A drawing in the house style, using the category's shape and the size you gave. It sits with the rest of the board immediately. |
| An image file you pick | Downscaled and stored in the browser. Everything keeps working, PNG export included. |
| An image address | Fetched and re-encoded locally if the other site allows it; if it does not, the form says so and tells you to download the file instead. |
| A generated image | See below. This is the one that makes it permanent. |

Sizes matter more than they look. The two millimetre figures are the footprint
as the thing lies on a board, and they are what put it at the right size next to
everything else. Each category has a sensible default if you do not know them.

### Generating the picture

**Your products → Image brief for the ones with no picture** writes a prompt per
product. The wording is not decorative: square-on, light from the top left, no
cast shadow and no background are exactly the four things that decide whether a
generated image sits with the drawings or floats over them looking like a
sticker. The brief also carries the real millimetre size and the source URL.

Hand the brief to an image generator (Higgsfield, or anything else), cut the
background out, then:

```
tools/edc-builder/media/stills/<id>.png     save the image here
tools/edc-builder/media/manifest.js         add  '<id>': 'stills/<id>.png'
```

At that point it is an ordinary catalogue product: the picture is in the repo,
so it survives a cleared browser and it reaches anyone you share the board with.

**A generated image is a likeness, not a photograph of the real article.** An
image model works from a name and a description, not from the product, so it
produces something plausible rather than something accurate — proportions and
details will be wrong in ways that matter to anyone who owns one. That is fine
for a layout board and not fine for anything that implies you are showing the
actual product. The app labels these, and so should you.

## What travels, and what does not

| | Share link | JSON export | Repo |
| --- | --- | --- | --- |
| Catalogue items | yes | yes | yes |
| Your own products' details | yes | yes | only once added to `catalog.js` |
| Your own products' pictures | **no** | yes | yes, once in `media/` |

A share link has to stay a link, and a picture is tens of kilobytes, so pictures
do not go in one — the recipient sees the drawn stand-in with the right name,
price, weight and size. Use the JSON export to move pictures between your own
machines, and `media/` to make them permanent for everyone.

## The media library

`media/manifest.js` maps a product id to an image, and that image replaces the
drawing everywhere — catalogue card, pack list and board. It works for
catalogue products and for your own alike; products you add put their picture
into the same table at runtime, which is why one code path serves both.

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

The bundle inlines everything and makes no network requests at all.

**Saving files works two ways**, because one way is not enough. A page opened
from disk or off a web server saves through an anchor, which is all it has. A
page inside a host that blocks page-initiated downloads — the claude.ai artifact
viewer does — would find that anchor silently inert, and **Download PNG** would
look like it worked while doing nothing. So `share.js` asks the host for a
`downloads` capability first (`claude.use('downloads')`) and falls back to the
anchor when there is none. The message afterwards says which happened rather
than claiming success it cannot verify, and JSON export always prints into the
page as well so a blocked file is never the only copy.

## Relationship to the rest of this repository

Self-contained, and deliberately outside `_src/build.ps1`. That generator exists
to keep the `LocalBusiness` schema and NAP identical across the 35 pages of the
Flanagan's site; it has nothing to offer an interactive app. Nothing here is
linked from the site and the page carries `noindex, nofollow`, the same
arrangement as `tools/20-year-test/`.
