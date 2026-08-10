# TV Guide Channel (JMO TV Guide)

A retro cable "Prevue Channel"-style scrolling program grid, built as a static
OBS/browser visualizer. Listings come from `tv-guide/guide.csv` in the same
directory.

## What it does

- **Scrolling grid** — channel column on the left, 30-minute time slots across
  the top (default 90-minute window starting at the current half hour),
  program blocks spanning their real duration. Rows auto-scroll vertically in
  a seamless loop when they overflow.
- **Promo box** — cycles through what's airing right now across all channels.
- **Clock/date header** — live clock, retro styling, scanlines + vignette.
- **Live CSV reload** — `guide.csv` is re-fetched every 60 seconds with a
  cache-busting query param, so edits show up in OBS without a manual refresh.
- Designed for 16:9; all sizing is viewport-relative (vh/vw), so it scales
  cleanly at a 1920x1080 browser source.

## guide.csv format

Columns: `channel,title,start,end,description` (header row optional;
`description` optional). Blank lines and `#` comment lines are ignored;
quoted fields with commas work.

- `channel` — display string. `"02 JMO"` renders as big number + call sign;
  anything else renders as a plain name. Channels appear in first-seen order.
- `start` / `end` — 24h `HH:MM`, repeating daily. `end <= start` wraps past
  midnight (`23:00,01:00`). Hours up to 47 or a `+1` suffix also roll into the
  next day (`25:30` == `01:30+1`).
- Rows that fail to parse are skipped with a `console.warn`, never break the
  page.

Example:

```csv
channel,title,start,end,description
02 JMO,Pokémon: Victory Road,14:00,19:00,The long climb to the Elite Four.
06 WTHR,"Local on the 8s",12:00,18:00,Current conditions every 10 minutes-ish.
```

## URL parameters

- `window` — visible minutes across the grid (60–240, default 90).
- `speed` — vertical scroll speed in px/sec (5–200, default 34).
- `refresh` — CSV reload interval in seconds (10–3600, default 60).

## Hosted vs local usage

The other visualizers in this repo are used as OBS browser sources via the
GitHub Pages URLs (see `stream-ops/configs/scene_music.json`), e.g.:

```text
https://jvmisxn.github.io/jmo-visualizers/tv-guide/?dpr=1&fps=30&seed=obs
```

Hosted mode serves the **committed** `guide.csv` — editing listings means
commit + push, then wait out the Pages deploy. Fine for a stable schedule,
bad for quick edits.

For truly local editing, point the OBS browser source at the local clone
instead:

1. `cd ~/.openclaw/workspace/visualizers && python3 -m http.server 8770`
2. OBS browser source URL: `http://localhost:8770/tv-guide/`
3. Edit `tv-guide/guide.csv`; the grid picks it up within 60 seconds.

`file:///…/tv-guide/index.html` also renders, but Chrome/OBS CEF blocks
`fetch()` of the CSV from `file://` origins, so use the http server (or
hosted URL) for the live-reload workflow.

## Files

- `index.html` — markup for the promo box, clock, time bar, and grid
- `styles.css` — all layout and retro Prevue theming
- `app.js` — CSV parsing, grid layout, scroll loop, clock, promo rotation
- `guide.csv` — the listings feed (sample JMO TV schedule included)

`app.js` exports its parser (`parseCSV`, `parseTime`, `parseGuide`,
`programWindow`) for node, so the CSV logic can be checked headlessly:

```sh
node -e 'const g=require("./tv-guide/app.js");
  console.log(g.parseGuide(require("fs").readFileSync("tv-guide/guide.csv","utf8")).channels.length)'
```
