# National Parks Channel

Fake-broadcast "parks channel" visualizer for OBS browser sources, in the same
family as `weather-radar` and `stock-channel`. Rotates through ten flagship US
national parks with a procedurally drawn scenic panorama, live conditions
cards, and a ticker.

## Layout

- **Scenic panorama** — full-bleed canvas scene generated per park (seeded by
  park name): layered ridges, canyon strata, snowcaps, forests, lake water,
  an animated Old Faithful steam plume, stars/moon at night, sun by day.
  Sky and lighting follow the park's local time; rain/snow overlays follow the
  park's current weather code. This is fully offline-safe — no network needed.
- **PARK CAM inset** — a small curated list of long-lived NPS webcam JPGs
  (Old Faithful, Mount Rainier Paradise, Olympic Hurricane Ridge). Images are
  probed off-screen; on any failure the panel silently hides. No scraping.
- **Cards** — conditions (temp/wind/precip/humidity), US AQI with category
  color, sunrise/sunset/daylight, and a static "park file" (established,
  acreage, annual visitors, fun fact).
- **Ticker** — park weather readings, park facts, and ranger-style PSAs.

## Data sources

- `api.open-meteo.com/v1/forecast` — current conditions + daily
  sunrise/sunset/precip probability, `timezone=auto` (keyless, CORS-enabled).
- `air-quality-api.open-meteo.com/v1/air-quality` — current US AQI (keyless).
- Park facts/acreage/visitors are static curated data in `app.js` (`PARKS`).

Responses are cached per park for 10 minutes; a failed refresh keeps the last
good data, and a total failure shows `DATA LINK DOWN` instead of breaking the
frame.

## Usage

Static files, no build step. Serve the repo root (or open via GitHub Pages)
and point an OBS browser source at `national-parks/index.html`, 1920×1080.

Rotation: 26 s per park, 10 stops. Edit `PARKS` in `app.js` to change stops,
`STOP_MS` for pacing.
