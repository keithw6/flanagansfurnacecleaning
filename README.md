# flanagansfurnacecleaning.com

Local SEO site for Flanagan's Furnace & Duct Cleaning Service, Calgary. 35 pages, static, no build dependencies beyond PowerShell.

## Structure

```
/                        35 generated .html pages (do not edit directly)
/_src/template.html      shared shell: head, CSS, header, nav, footer, schema slot
/_src/build.ps1          generator + the single source of truth for NAP schema
/_src/pages/*.html       one content file per page, with a meta block on top
/_preview/               local preview zips, gitignored, not published
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
