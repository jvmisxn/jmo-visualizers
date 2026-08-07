# Retro Shopping Channel (Shop-O-Rama)

A fake late-night home-shopping broadcast in VHS style, built as a static
OBS/browser visualizer. No external data, no network calls — everything is
self-contained HTML/CSS/JS.

## What it does

- **Rotating product showcase** — 10 parody retro products (emoji hero art,
  taglines, animated feature bullets, "AS SEEN ON TV"-style badges). A new
  product rotates in every 90 seconds via a static-burst transition.
- **Price panel** — struck-through retail price, throbbing sale price, EZ-pay
  plan, live stock bar, and a "sold today" counter that ticks up. When the
  offer countdown hits 30 seconds, the price *drops even lower* with a flash.
- **Countdown** — per-offer "OFFER ENDS IN" timer that blinks red in the last
  15 seconds, then triggers the next product.
- **Call-now lower third** — flashing CALL NOW strap with a 555 phone number
  and a rotating host name.
- **Ticker** — seamless looping gold ticker with operator-standing-by copy.
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
- `app.js` — product rotation, countdown, ticker, clock, glitch scheduling

## Tuning

In `app.js`:

- `OFFER_SECONDS` — seconds per product (default 90)
- `PRICE_DROP_AT` — seconds remaining when the mid-offer price drop fires
- `PRODUCTS`, `HOSTS`, `TICKER_ITEMS` — the catalog and copy
- Glitch frequency — ranges in `scheduleRandomGlitches` / `scheduleTrackingRolls`
