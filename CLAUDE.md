# billlinphoto.com — notes for Claude

Bill Lin's street-photography site. Plain static HTML/CSS/JS, no build step. Hosted from this repo (Cloudflare Pages auto-deploys `main`). The owner edits by asking Claude in chat; he does not edit code himself. Reply to him in Traditional Chinese (Taiwan).

## Structure
- One `.html` file per page. Every page has the same `<head>` and `<main>` wrapper; header, mobile menu and footer are injected by `js/main.js` (the copyright footer is placed inside the bottom of the last section of `<main>`, over its photo or colour, with no band of its own; the year is automatic) — edit nav links, Instagram/YouTube URLs and the footer there, not in each page.
- `css/style.css` — all styles; colors/fonts are tokens at the top (`--gray`, `--sage`, `--serif` = Cormorant Garamond, `--sans`).
- `js/config.js` — shop settings (Shopify store address and public token, shipping note, multi-print discount); see Shop below.
- `images/` — all photos, flat folder, named by camera file number (e.g. `DSC05015.jpg`).
- `favicon.svg` + `apple-touch-icon.png` (BL monogram), `sitemap.xml`, `robots.txt`, `_headers` (Cloudflare cache headers).
- Every public page's `<head>` has a page-specific `description`, `canonical` (pretty URL without `.html`, as Cloudflare Pages serves it), Open Graph tags (`og:image` = the page's lead photo, absolute `https://billlinphoto.com/images/...`) and `twitter:card`; `cart.html` and `404.html` are `noindex`. A new page gets the same tags and a line in `sitemap.xml`.

## Pages
- `index.html` home (hero, about blurb, shop collage)
- `about.html` — hero line ("An Aviator, A Photographer, An Engineer.") and an "About Me" bio (`.about-bio`, ~500 words, photography-focused)
- `gallery.html` — opens with the world map of cities (no quote section) (inline SVG in `.city-section`; Boston → `boston.html`, New York → `new-york.html`, the other six are "coming soon"), masonry, "Autumn in Boston 2023", "New York City" (`id="new-york"`)
- `boston.html` — Boston masonry album (4 columns)
- `new-york.html` — New York masonry album (3 columns); the same photos also appear in the Gallery page's New York City section
- `blog.html` — list of posts; `autumn-in-boston.html` — the one post
- `cart.html` — cart page (same view as the cart drawer, rendered by `js/main.js`)
- `shop.html` — product grid with category filter (`data-cats` on each card: prints / postcards / presets); `transient-serenity.html` — product page
- `404.html`
- There is intentionally no contact page.

## Common edits
- **Add photos to an album:** add `<figure class="zoom"><img src="images/NAME.jpg" alt="..."></figure>` inside the `.masonry` (no `loading="lazy"` in masonry) or grid. A `data-group` ancestor scopes the lightbox's prev/next.
- **New blog post:** copy `autumn-in-boston.html` (keep `data-page="blog"`). In `blog.html` the newest post is the `.post-card.featured` article (photo left, text right); move the previous featured post into `.post-grid` as a plain `<article class="post-card">` (same inner markup, image `sizes="(max-width: 760px) 92vw, 44vw"`), then put the new post in the featured slot. Each card has meta (date · city; no reading time), title, a 2–3 sentence excerpt taken from the post, and "Read the story →".
- **New city album:** copy `boston.html`. In `gallery.html`, turn that city's map pin from `<g class="pin soon" tabindex="0" ...>` into `<a class="pin live" href="CITY.html" aria-label="CITY photos">`: copy the Boston pin's structure (callout group with leader path, label box and label text; halo r=11; hit r=7; dot r=5.5), keep the city's own coordinates, and drop the "Coming soon" tip text (live label box is 24 tall, label baseline at leader end +5). Then turn its `<span>` in `.city-list` into `<a href="CITY.html">CITY</a>`. Label box widths are set by `js/main.js`. To add a brand-new city, project it with d3 geoNaturalEarth1 fitted to the 1000×470 viewBox from world-atlas countries-110m without Antarctica (examples: Boston 320,136 · Taipei 828,191 · Sydney 897,381); the callout goes from the dot to (x+14, y−14), then horizontally to x+32.
- **New product:** see Shop below.

## Photos
The owner wants the site as sharp as possible. He sends originals (often 30–50 MB, sometimes HEIC, often without filenames; photos pasted into chat arrive downscaled to ~2576 px, so ask for file attachments when a large version matters). Never commit originals (Cloudflare Pages rejects files over 25 MiB). Every photo gets up to three versions, all JPEG, EXIF orientation fixed, progressive:
- `images/sm/NAME.jpg` — long edge 1200 px, quality 85
- `images/NAME.jpg` — long edge up to 2560 px, quality 88, 4:4:4 chroma
- `images/full/NAME.jpg` — long edge up to 4000 px, quality 95, 4:4:4; only when the source is larger than 2700 px
Apply light unsharp mask (radius 0.6, 45%, threshold 2) only after a downscale below 75%.
Every `<img src="images/NAME.jpg">` carries `srcset="images/sm/NAME.jpg 1200w, images/NAME.jpg <width>w"`, a `sizes` value matching its layout (see existing tags), `decoding="async"`, and `data-full="images/full/NAME.jpg"` when the full version exists — the lightbox loads `data-full`. CSS backgrounds use `images/NAME.jpg`.

## Shop (headless Shopify + Prodigi, modelled on skypathstudio.com)
The owner chose skypathstudio.com as the model: the site keeps its own pages and cart drawer, the cart lives in Shopify, checkout is Shopify's, and Prodigi's Shopify app prints and ships every order. There is no server code (the old PayPal + Prodigi Cloudflare Functions were removed). The owner is in Taiwan: Shopify Payments, Shop Pay and Managed Markets/Global-e are not available to him, so his Shopify checkout takes payment through PayPal (and any other third-party gateway he adds); Shopify adds its third-party transaction fee.
- `js/config.js` → `SITE_CONFIG.shopify = { domain: "xxx.myshopify.com", token: "<public Storefront API token>" }` (from the Headless channel in Shopify admin; this token is public by design and lives in the page). Also `shippingNote` (cart strip text; match the Shopify shipping rate) and `bundleDiscount` (e.g. `[{qty:2,percent:10},{qty:3,percent:20}]`; only turn on after the same automatic discount exists in Shopify, since Shopify applies the real discount at checkout). Empty domain/token = shop not connected: product pages show the options written in the HTML and "Online ordering is coming soon."
- `js/main.js` talks to the Storefront API (`API_VERSION`): `cartCreate`, `cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove`, `cart(id)`; the cart id is kept in localStorage `billlin-shopify-cart` and the badge count in `billlin-cart-count`. A cart Shopify no longer returns (ordered or expired) is forgotten. Checkout goes to the cart's `checkoutUrl`.
- Product page: `.product-info[data-handle]` = the Shopify product handle, which must also be the page's filename (`<handle>.html`, the cart links lines back to it). Options, prices and sold-out state come from Shopify and are rendered into `.product-options` as button groups (one per Shopify option; prices shown on buttons when they differ); the HTML inside `.product-options` is only the fallback before Shopify answers. Black pill "Add to cart" → "Adding…" → cart drawer. `.bundle-box` shows the multi-print discount box when `bundleDiscount` is set.
- Cart drawer ("Your cart", from the right over a blurred backdrop): optional discount progress box, item cards (thumbnail, title, variant, line price, − qty + stepper, trash; max 10), Subtotal, shipping strip, black pill Checkout, "Secure checkout · PayPal and cards accepted". Header cart icon (round sage count badge) opens it; `cart.html` shows the same view as a page.
- Prices, variants, discounts, shipping rates, taxes, order emails and refunds are all managed in Shopify admin. Print files are uploaded per product in the Prodigi app, which maps each Shopify variant to a Prodigi SKU and fulfils automatically.
- **New product:** owner creates it in Shopify (handle e.g. `my-photo`) and links it in the Prodigi app; Claude copies `transient-serenity.html` to `my-photo.html`, sets `data-handle`, title, photo, description and fallback option buttons, and adds a `.product-card` to `shop.html`.
- Never ask the owner to paste private keys (Admin API tokens, passwords) into chat; the public Storefront token is the only key the site uses.

## Commits
Commit straight to `main` with a short message describing the change; the site redeploys in about a minute.
