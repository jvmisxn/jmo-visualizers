# Starfield Visualizer

Static canvas starfield for OBS/browser sources. It runs without a build step. Star travel stays locked to a steady slow pace; clicking the page or pressing `M` enables optional microphone glow/pulse reactivity without changing movement speed.

## Open

Hosted URL:

```text
https://jvmisxn.github.io/jmo-visualizers/starfield/
```

Use that URL directly in OBS Browser Source for the cleanest setup.

Local fallback:

```sh
open /Users/jamison/.openclaw/workspace/visualizers/starfield/index.html
```

Or serve the workspace locally:

```sh
python3 -m http.server 8766
```

Then set OBS to:

```text
http://localhost:8766/visualizers/starfield/
```

## URL Parameters

- `density=900` star count baseline
- `speed=1` travel speed
- `warp=1` depth stretch
- `hue=198` base color hue
- `tint=0.58` color intensity
- `trails=0.23` trail persistence
- `pulse=1` audio pulse strength

Example:

```text
https://jvmisxn.github.io/jmo-visualizers/starfield/?density=1300&speed=1.25&hue=210&trails=0.18
```
