# flanagansfurnacecleaning.com

Local SEO site for Flanagan's Furnace & Duct Cleaning Service, Calgary. 35 pages, static, no build dependencies beyond PowerShell.

## Structure

```
/                        35 generated .html pages (do not edit directly)
/_src/template.html      shared shell: head, CSS, header, nav, footer, schema slot
/_src/build.ps1          generator + the single source of truth for NAP schema
/_src/pages/*.html       one content file per page, with a meta block on top
/_preview/               local preview zips, gitignored, not published
/tools/20-year-test/     standalone calculator app, not part of the site build
/tools/edc-builder/      standalone everyday-carry board builder, likewise
```

Every root `.html` file is generated. Edit `_src/pages/` instead and rebuild:

```
powershell -ExecutionPolicy Bypass -File _src\build.ps1
```

## Why it is built this way

Thirty-five pages each carrying the same header, footer, nav and `LocalBusiness` schema is thirty-five chances for the NAP to drift. NAP consistency feeds Google Business Profile verification and map ranking, so it has to be exact. The generator makes drift impossible: change `_src/template.html` or the `$BIZ` block in `_src/build.ps1` once, rebuild, and all 35 pages move together.

FAQ schema on `faq.html` is generated directly from the visible Q&A markup, so the structured data and the page content cannot disagree.

## Page meta block

Each file in `_src/pages/` starts with:

```
<!--meta
title:      <title> tag, unique per page
desc:       meta description, 120-165 chars
ogdesc:     optional, falls back to desc
canon:      optional, defaults to the filename. Empty string for the homepage
sname:      Service schema name, omit for pages with no Service node
stype:      Service schema serviceType
sdesc:      Service schema description
area:       optional Place name for area-specific Service schema
bcparent:   optional "Label|filename.html" for a breadcrumb parent
bcname:     this page's breadcrumb label, omit on the homepage
faqauto:    set to yes to generate FAQPage schema from .qa blocks
-->
```

## Site facts

Two head-term landing pages that must not compete: `index.html` owns "furnace cleaning Calgary", `duct-cleaning-calgary.html` owns "duct cleaning Calgary". Both cross-link with varied anchor text.

Hub and spoke: home → services + four quadrant hubs → 19 community pages → back to hubs and services. Internal linking is weighted toward the NE communities nearest the shop.

## Before publishing

See `DEPLOY.md`. There are placeholders in the source that must be replaced first — email address, Web3Forms key, three real customer reviews, and ten prices.

`GBP-SETUP.md` and `Flanagans-GBP-Setup-Guide.pdf` are operator and client documents. They are not linked from any page.

## tools/

Separate things that happen to live in this repo. Both are self-contained, have
no dependencies, and are deliberately outside `_src/build.ps1` — that generator
exists to keep NAP schema identical across 35 SEO pages and has nothing to offer
an interactive app. Neither is linked from the site and both carry
`noindex, nofollow`.

- **`tools/20-year-test/`** — the Blue Collar Business 20-Year Test, an
  interactive career and business comparison calculator.
  See `tools/20-year-test/README.md`.
- **`tools/edc-builder/`** — EDC Builder. Pick everyday-carry gear from a
  109-item catalogue, lay it out on a display board at true relative scale, and
  share the board as a link. The catalogue is drawn rather than photographed, so
  a board of ninety items reads as one flat-lay instead of a collage; any product
  can take a real photograph instead, cut out and trimmed on the way in.
  Add anything else by pasting its URL. See `tools/edc-builder/README.md`.
