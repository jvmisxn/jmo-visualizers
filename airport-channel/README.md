# JMO Airport Channel

Fake broadcast "airport information channel" for OBS browser sources, in the
same spirit as `weather-radar/` and `stock-channel/`. Full-screen 16:9, no
landing page, no build step — plain HTML/CSS/JS.

## What's on screen

- **Departures board** (left) — split-flap-style rows: time, flight, destination,
  gate, status. Pages flip every 12 s.
- **Arrivals board** (top right) — compact version of the same.
- **Field conditions** (bottom right) — decoded METAR (wind, visibility,
  temp/dew, altimeter, ceiling, flight category) plus the raw METAR line.
- **Airfield view** (background canvas) — stylized ground-radar of three
  parallel runways (SEA-style) with taxiways, terminal, moving aircraft blips
  (green = departing, cyan = arriving), and a rotating beacon sweep.
- **Status lower-third** — rotating ramp/terminal desk messages.
- **Advisory ticker** — scrolling airport advisories plus live delay callouts
  pulled from the generated schedule.

## Data sources

- **Flights / advisories:** seeded demo data. The schedule is generated
  deterministically from the current date (mulberry32 PRNG), and statuses
  (BOARDING, FINAL CALL, DEPARTED, DELAYED…) are derived from the wall clock,
  so the board evolves in real time and looks consistent across reloads on the
  same day. Swap `buildSchedule()` for a real feed later — everything renders
  from that one structure.
- **Weather:** tries the public NOAA feed
  `https://aviationweather.gov/api/data/metar?format=json&ids=KSEA` (no key)
  every 10 minutes. On any failure it falls back to a seeded demo METAR and
  labels the panel "DEMO DATA". The source label always tells the truth.

## Configuration

Top of `app.js`:

- `AIRPORT` — ICAO/IATA code, display name, time zone.
- `AIRLINES`, `DESTINATIONS`, `ADVISORIES`, `STATUS_MESSAGES` — content pools.
- Row counts and rotation timings.

## OBS usage

Add as a browser source pointed at `airport-channel/index.html` (or the hosted
URL), 1920×1080. No audio, no interaction needed.
