# Deploying to GitHub Pages with the Namecheap domain

Target: `flanagansfurnacecleaning.com`, currently registered at Namecheap and sitting on a parking page.

---

## Before you start

**Do not publish while the placeholders are still in.** The site currently contains:

| Placeholder | Where | Needed from |
|---|---|---|
| `[FLANAGANS-EMAIL]` | All 35 pages, footer + schema + contact page | James |
| `[FLANAGANS-WEB3FORMS-KEY]` | contact.html form | James (free key from web3forms.com) |
| `[FLANAGANS-REVIEW-1/2/3]` | index.html testimonials | Three real customer reviews |
| `[PRICE-*]` (10 of them) | pricing.html | James |

Find-and-replace them across the `_src/pages/` files, then run the build (below). Never edit the root `.html` files directly — they are generated and your edits will be overwritten.

---

## Rebuilding the site

All 35 pages are generated from `_src/template.html` plus one content file per page in `_src/pages/`. This is what keeps the NAP, nav, footer and schema identical everywhere.

```
powershell -ExecutionPolicy Bypass -File _src\build.ps1
```

Change the address, phone or footer once in `_src/template.html` (and in the `$BIZ` block of `_src/build.ps1` for the schema), rebuild, and all 35 pages update together.

---

## Step 1 — Create the repository

1. On GitHub, create a new repository. Public is required for free GitHub Pages.
2. Name it `flanagansfurnacecleaning` (the name is not public-facing once the domain is attached).
3. Do **not** add a README, .gitignore or licence — this folder already has what it needs.

## Step 2 — Push this folder

From `C:\Work\flanagansfurnacecleaning`:

```
git init
```

```
git add .
```

```
git commit -m "Initial site build - 35 pages"
```

```
git branch -M main
```

```
git remote add origin https://github.com/YOUR-USERNAME/flanagansfurnacecleaning.git
```

```
git push -u origin main
```

The `_preview/` folder is excluded by `.gitignore`. The `_src/` folder is pushed but **not published** — GitHub Pages runs Jekyll, which ignores any directory starting with an underscore. That is deliberate: the source travels with the repo but never appears on the live site.

Do not add a `.nojekyll` file. That would disable the underscore rule and expose `_src/` publicly.

## Step 3 — Turn on GitHub Pages

1. Repository → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Save

Wait a minute or two, then check the `github.io` URL it gives you. The site should load. Confirm before touching DNS.

The `CNAME` file in this folder already contains `flanagansfurnacecleaning.com`, so GitHub will pick the custom domain up automatically.

---

## Step 4 — Point the Namecheap domain

Log into Namecheap → **Domain List** → **Manage** on flanagansfurnacecleaning.com → **Advanced DNS**.

### First: delete the parking records

The domain is on a Namecheap parking page right now. There will be existing records — typically a `URL Redirect` or `CNAME` on host `@` and `www`, and possibly an A record pointing at a parking IP.

**Delete all of them.** If they stay, they will fight the new records and the domain will keep serving the parking page.

### Then: add these

Four A records, all on host `@`:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | @ | 185.199.108.153 | Automatic |
| A Record | @ | 185.199.109.153 | Automatic |
| A Record | @ | 185.199.110.153 | Automatic |
| A Record | @ | 185.199.111.153 | Automatic |

Plus one CNAME so the www version works:

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME Record | www | YOUR-USERNAME.github.io. | Automatic |

Replace `YOUR-USERNAME` with your actual GitHub username. Keep the trailing dot.

Optionally add the IPv6 records as well — not required, but they help on mobile networks:

| Type | Host | Value |
|---|---|---|
| AAAA Record | @ | 2606:50c0:8000::153 |
| AAAA Record | @ | 2606:50c0:8001::153 |
| AAAA Record | @ | 2606:50c0:8002::153 |
| AAAA Record | @ | 2606:50c0:8003::153 |

## Step 5 — Wait, then enforce HTTPS

DNS usually propagates within 30 minutes on Namecheap but can take up to 24 hours.

Once `flanagansfurnacecleaning.com` loads the site:

1. Repository → **Settings** → **Pages**
2. Confirm the custom domain shows a green check
3. Tick **Enforce HTTPS**

That checkbox stays greyed out until GitHub has issued the certificate, which can take another hour after DNS resolves. Do not skip it — every canonical URL, the sitemap and every schema block on the site uses `https://`.

---

## Step 6 — After it is live

- [ ] Visit `https://flanagansfurnacecleaning.com/sitemap.xml` and confirm it loads
- [ ] Visit `https://flanagansfurnacecleaning.com/robots.txt` and confirm it loads
- [ ] Submit the site to [Google Search Console](https://search.google.com/search-console) and submit the sitemap
- [ ] Run the two head-term pages through [Google's Rich Results Test](https://search.google.com/test/rich-results) to confirm the `LocalBusiness` and `Service` schema is read correctly
- [ ] Test the contact form actually delivers, once the Web3Forms key is in
- [ ] Point the Google Business Profile website field at the domain (see `GBP-SETUP.md`)

---

## Updating the site later

```
powershell -ExecutionPolicy Bypass -File _src\build.ps1
```

```
git add .
```

```
git commit -m "Describe what changed"
```

```
git push
```

GitHub Pages redeploys within about a minute.

---

## A note on the Web3Forms key

The form posts to Web3Forms from the browser, which works fine on GitHub Pages since there is no server-side code involved. The access key is visible in the page source — that is normal and by design for Web3Forms. It only allows submitting to James's inbox; it cannot be used to read anything.

The honeypot field (`botcheck`) is already in place and hidden off-screen. Web3Forms discards any submission where it is filled.
