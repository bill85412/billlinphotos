# billlinphoto.com — notes for Claude

Bill Lin's street-photography site. Plain static HTML/CSS/JS, no build step. Hosted from this repo (Cloudflare Pages auto-deploys `main`). The owner edits by asking Claude in chat; he does not edit code himself. Reply to him in Traditional Chinese (Taiwan).

## Structure
- One `.html` file per page. Every page has the same `<head>` and `<main>` wrapper; header, mobile menu and footer are injected by `js/main.js` — edit nav links, Instagram/YouTube URLs and the footer there, not in each page.
- `css/style.css` — all styles; colors/fonts are tokens at the top (`--gray`, `--sage`, `--serif` = Cormorant Garamond, `--sans`).
- `js/config.js` — empty placeholder; shop settings moved to the server (see Shop below).
- `images/` — all photos, flat folder, named by camera file number (e.g. `DSC05015.jpg`).

## Pages
- `index.html` home (hero, about blurb, shop collage)
- `about.html`
- `gallery.html` — world map of cities (inline SVG in `.city-section`; Boston → `boston.html`, New York → `new-york.html`, the other six are "coming soon"), masonry, "Autumn in Boston 2023", "New York City" (`id="new-york"`)
- `boston.html` — Boston masonry album (4 columns)
- `new-york.html` — New York masonry album (3 columns); the same photos also appear in the Gallery page's New York City section
- `blog.html` — list of posts; `autumn-in-boston.html` — the one post
- `cart.html` — shopping cart (rendered by `js/main.js`)
- `shop.html` — product grid with category filter (`data-cats` on each card: prints / postcards / presets); `transient-serenity.html` — product page
- `404.html`
- There is intentionally no contact page.

## Common edits
- **Add photos to an album:** add `<figure class="zoom"><img src="images/NAME.jpg" alt="..."></figure>` inside the `.masonry` (no `loading="lazy"` in masonry) or grid. A `data-group` ancestor scopes the lightbox's prev/next.
- **New blog post:** copy `autumn-in-boston.html` (keep `data-page="blog"`). In `blog.html` the newest post is the `.post-card.featured` article (photo left, text right); move the previous featured post into `.post-grid` as a plain `<article class="post-card">` (same inner markup, image `sizes="(max-width: 760px) 92vw, 44vw"`), then put the new post in the featured slot. Each card has meta (date · city; no reading time), title, a 2–3 sentence excerpt taken from the post, and "Read the story →".
- **New city album:** copy `boston.html`. In `gallery.html`, turn that city's map pin from `<g class="pin soon" tabindex="0" ...>` into `<a class="pin live" href="CITY.html" aria-label="CITY photos">`: copy the Boston pin's structure (callout group with leader path, label box and label text; halo r=11; hit r=7; dot r=5.5), keep the city's own coordinates, and drop the "Coming soon" tip text (live label box is 24 tall, label baseline at leader end +5). Then turn its `<span>` in `.city-list` into `<a href="CITY.html">CITY</a>`. Label box widths are set by `js/main.js`. To add a brand-new city, project it with d3 geoNaturalEarth1 fitted to the 1000×470 viewBox from world-atlas countries-110m without Antarctica (examples: Boston 320,136 · Taipei 828,191 · Sydney 897,381); the callout goes from the dot to (x+14, y−14), then horizontally to x+32.
- **New product:** copy `transient-serenity.html` (update `data-slug`, `data-title`, options with `data-price`), add a `.product-card` to `shop.html`, and add the product to `functions/_lib/catalog.js` (price in cents, Prodigi SKU per option, `printFile`). The option `value`s on the page must match the variant keys in the catalog. Ask the owner to upload the full-resolution print file to the R2 bucket `print-files`.

## Photos
The owner wants the site as sharp as possible. He sends originals (often 30–50 MB, sometimes HEIC, often without filenames; photos pasted into chat arrive downscaled to ~2576 px, so ask for file attachments when a large version matters). Never commit originals (Cloudflare Pages rejects files over 25 MiB). Every photo gets up to three versions, all JPEG, EXIF orientation fixed, progressive:
- `images/sm/NAME.jpg` — long edge 1200 px, quality 85
- `images/NAME.jpg` — long edge up to 2560 px, quality 88, 4:4:4 chroma
- `images/full/NAME.jpg` — long edge up to 4000 px, quality 95, 4:4:4; only when the source is larger than 2700 px
Apply light unsharp mask (radius 0.6, 45%, threshold 2) only after a downscale below 75%.
Every `<img src="images/NAME.jpg">` carries `srcset="images/sm/NAME.jpg 1200w, images/NAME.jpg <width>w"`, a `sizes` value matching its layout (see existing tags), `decoding="async"`, and `data-full="images/full/NAME.jpg"` when the full version exists — the lightbox loads `data-full`. CSS backgrounds use `images/NAME.jpg`.

## Shop (PayPal + Prodigi, Cloudflare Pages Functions)
The owner is in Taiwan, where Stripe is not available, so payments go through PayPal.
- Cart: `js/main.js` keeps the cart in localStorage (`billlin-cart`: slug, title, variant, display price, image, url, quantity; max 10 per line). "Add To Cart" on a product page adds to it; the header cart icon (desktop and mobile) shows the count and links to `cart.html`, which renders lines, quantity +/−, remove, subtotal/shipping/total and "Check out with PayPal". `cart.html`'s `data-shipping`/`data-shipping-label` must match `SHIPPING` in the catalog; the product page's `data-price` options must match catalog prices (the server price is what is charged). `order-success.html` empties the cart.
- `functions/api/checkout.js` — POST `{items: [{slug, variant, quantity}]}` → merges repeated lines, checks each against `functions/_lib/catalog.js` (prices never come from the browser) → one PayPal Orders v2 order (intent CAPTURE; each line item's `sku` = `slug|variant`; `shipping_preference: GET_FROM_FILE`; cancel → `cart.html`) → returns `{url}` (the `payer-action` link). If checkout is not set up, the cart page shows "Online ordering is coming soon."
- `functions/api/paypal-return.js` — PayPal's return URL. Captures the order (`ORDER_ALREADY_CAPTURED` counts as success) → `order-success.html`; a failed capture → `cart.html?payment=failed`.
- `functions/api/paypal-webhook.js` — `PAYMENT.CAPTURE.COMPLETED` → verifies via PayPal's verify-webhook-signature API → re-reads the order from PayPal → turns every line item (`sku` = `slug|variant`) into one Prodigi order (v5 API, `https://api.prodigi.com/v5/orders`; key prefix `sandbox_`/`live_` picks the environment) → writes marker `orders/<paypalOrderId>.json` in the R2 bucket, which is the duplicate guard. Errors return 500 so PayPal retries.
- `functions/api/print-file/[name].js` — serves print files from the private R2 bucket bound as `PRINT_FILES`, only with `?token=PRINT_FILE_TOKEN`.
- `functions/_lib/paypal.js` — OAuth token, REST calls, webhook verification. `PAYPAL_ENV=live` → api-m.paypal.com, otherwise sandbox.
- Cloudflare Pages environment variables: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV`, `PRODIGI_API_KEY`, `PRINT_FILE_TOKEN`, `SITE_URL`; R2 binding `PRINT_FILES`. Never ask the owner to paste these keys into chat.
- Tests: copy `functions/` and `tests/shop.test.mjs` into one scratch folder with a `{"type":"module"}` package.json and run `node shop.test.mjs` (fake PayPal, Prodigi and R2; Node 18+). Run them after any change to `functions/`.
- The Prodigi SKUs in the catalog (`GLOBAL-CAN-16X24`, `GLOBAL-CFPM-16X24`) are placeholders until confirmed in the owner's Prodigi product catalog.

## Commits
Commit straight to `main` with a short message describing the change; the site redeploys in about a minute.
