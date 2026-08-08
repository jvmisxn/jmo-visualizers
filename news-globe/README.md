# JMO News Globe

Broadcast-style global news flyover for OBS.

Hosted path: <https://jvmisxn.github.io/jmo-visualizers/news-globe/>

## Behavior

- Flies between global regions using the same vendored Leaflet/CARTO stack as the weather visualizer.
- Fetches recent English-language headlines from GDELT when available.
- Falls back to a curated regional scan so the source remains usable offline or during API failures.
- Highlights major/conflict/disaster terms with red pins and a major-story banner.

## Query Params

- `?live=0` disables GDELT and airs only the curated fallback reel.
- `?speed=fast` shortens region dwell time for testing.
