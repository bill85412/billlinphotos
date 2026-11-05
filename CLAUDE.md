# billlinphoto.com — notes for Claude

Bill Lin's street-photography site. Plain static HTML/CSS/JS, no build step. Hosted from this repo (Cloudflare Pages auto-deploys `main`). The owner edits by asking Claude in chat; he does not edit code himself. Reply to him in Traditional Chinese (Taiwan).

## Structure
- One `.html` file per page. Every page has the same `<head>` and `<main>` wrapper; header, mobile menu and footer are injected by `js/main.js` — edit nav links, Instagram/YouTube URLs and the footer there, not in each page.
- `css/style.css` — all styles; colors/fonts are tokens at the top (`--gray`, `--sage`, `--serif` = Cormorant Garamond, `--sans`).
- `js/config.js` — shop payment links (`stripeLinks`). Empty link → "Add To Cart" shows "Online ordering is coming soon."
- `images/` — all photos, flat folder, named by camera file number (e.g. `DSC05015.jpg`).

## Pages
- `index.html` home (hero, about blurb, shop collage)
- `about.html`
- `gallery.html` — world map of cities (inline SVG in `.city-section`; Boston → `boston.html`, New York → `#new-york` section, the other six are "coming soon"), masonry, "Autumn in Boston 2023", "New York City" (`id="new-york"`)
- `boston.html` — Boston masonry album
- `blog.html` — list of posts; `autumn-in-boston.html` — the one post
- `shop.html` — product grid with category filter (`data-cats` on each card: prints / postcards / presets); `transient-serenity.html` — product page
- `404.html`
- There is intentionally no contact page.

## Common edits
- **Add photos to an album:** add `<figure class="zoom"><img src="images/NAME.jpg" alt="..."></figure>` inside the `.masonry` (no `loading="lazy"` in masonry) or grid. A `data-group` ancestor scopes the lightbox's prev/next.
- **New blog post:** copy `autumn-in-boston.html` (keep `data-page="blog"`), add a `.blog-card` to `blog.html` (newest first).
- **New city album:** copy `boston.html`. In `gallery.html`, turn that city's map pin from `<g class="pin soon" tabindex="0" ...>` into `<a class="pin live" href="CITY.html" aria-label="CITY photos">`: copy the Boston pin's structure (callout group with leader path, label box and label text; halo r=11; hit r=7; dot r=5.5), keep the city's own coordinates, and drop the "Coming soon" tip text (live label box is 24 tall, label baseline at leader end +5). Then turn its `<span>` in `.city-list` into `<a href="CITY.html">CITY</a>`. Label box widths are set by `js/main.js`. To add a brand-new city, project it with d3 geoNaturalEarth1 fitted to the 1000×470 viewBox from world-atlas countries-110m without Antarctica (examples: Boston 320,136 · Taipei 828,191 · Sydney 897,381); the callout goes from the dot to (x+14, y−14), then horizontally to x+32.
- **New product:** copy `transient-serenity.html` (update `data-slug`, `data-title`, options with `data-price`), add a `.product-card` to `shop.html`, add the slug to `stripeLinks`.

## Photos
The owner wants the site as sharp as possible. He sends originals (often 30–50 MB, sometimes HEIC, often without filenames; photos pasted into chat arrive downscaled to ~2576 px, so ask for file attachments when a large version matters). Never commit originals (Cloudflare Pages rejects files over 25 MiB). Every photo gets up to three versions, all JPEG, EXIF orientation fixed, progressive:
- `images/sm/NAME.jpg` — long edge 1200 px, quality 85
- `images/NAME.jpg` — long edge up to 2560 px, quality 88, 4:4:4 chroma
- `images/full/NAME.jpg` — long edge up to 4000 px, quality 95, 4:4:4; only when the source is larger than 2700 px
Apply light unsharp mask (radius 0.6, 45%, threshold 2) only after a downscale below 75%.
Every `<img src="images/NAME.jpg">` carries `srcset="images/sm/NAME.jpg 1200w, images/NAME.jpg <width>w"`, a `sizes` value matching its layout (see existing tags), `decoding="async"`, and `data-full="images/full/NAME.jpg"` when the full version exists — the lightbox loads `data-full`. CSS backgrounds use `images/NAME.jpg`.

## Commits
Commit straight to `main` with a short message describing the change; the site redeploys in about a minute.
