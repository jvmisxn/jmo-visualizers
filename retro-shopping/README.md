# Retro Shopping Channel (Shop-O-Rama)

A real-product late-night home-shopping broadcast in VHS style, built as a
static OBS/browser visualizer. Product data comes from
`retro-shopping/products.json`, generated from a public Fourthwall collection
feed.

## What it does

- **Rotating product showcase** — real product names, images, prices, variants,
  source update time, availability, and product URLs.
- **Price panel** — real listed price and availability. No invented stock
  quantities, sales counters, or countdowns.
- **Lower third** — source feed identification.
- **Ticker** — real product titles, prices, availability, and feed age.
- **VHS treatment** — scanlines, vignette, tape wobble, chromatic-aberration
  text shadows, random static bursts (canvas noise + glitch jolt), rolling
  tracking bar, and an occasional "PLAY ▶" OSD blip.

## Usage

Open `index.html` directly, or add an OBS Browser Source pointing at the
hosted path (`.../retro-shopping/`). Designed for 16:9; the set letterboxes
to fit any browser-source size. All sizing is viewport-relative (vw), so it
scales cleanly from 720p to 4K.

## Files

- `index.html` — markup for the set, panels, overlays
- `styles.css` — all layout, theming, and VHS effect styling
- `app.js` — product rotation, ticker, clock, glitch scheduling
- `products.json` — generated public product snapshot

## Tuning

In `app.js`:

- `DATA_URL` — generated product snapshot path.
- `ROTATE_MS` — product rotation timing.
- `SHOP_FEED_URL` GitHub Actions variable — optional source collection URL.
