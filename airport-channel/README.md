# JMO Airport Channel

Real-data-only airport information channel for OBS browser sources, in the
same spirit as `weather-radar/` and `stock-channel/`. Full-screen 16:9, no
landing page, no build step — plain HTML/CSS/JS.

## What's on screen

- **FAA NAS Status** (left) — real FAA airport delay/closure/status entries for
  SEA. If none are active, the board says so.
- **Aviation WX** (top right) — real NOAA METAR/TAF product status.
- **Field conditions** (bottom right) — decoded METAR (wind, visibility,
  temp/dew, altimeter, ceiling, flight category) plus the raw METAR line.
- **Airfield view** (background canvas) — stylized ground-radar of three
  parallel runways (SEA-style) with taxiways, terminal, moving aircraft blips
  (green = departing, cyan = arriving), and a rotating beacon sweep.
- **Status lower-third** — source-policy notes.
- **Advisory ticker** — FAA/NOAA raw products and active NAS events.

## Data sources

- **FAA NAS Status:** generated into `airport-channel/data.json` from
  `https://nasstatus.faa.gov/api/airport-status-information`.
- **NOAA AviationWeather:** generated into `airport-channel/data.json` from
  KSEA METAR and TAF endpoints. AviationWeather does not permit browser CORS,
  so GitHub Actions snapshots it server-side. On failure, the page marks the
  feed unavailable. No demo METAR is generated.

## Configuration

Top of `app.js`:

- `AIRPORT` — ICAO/IATA code, display name, time zone.
- `DATA_URL` — real JSON snapshot path.
- Row counts and rotation timings.

## OBS usage

Add as a browser source pointed at `airport-channel/index.html` (or the hosted
URL), 1920×1080. No audio, no interaction needed.
