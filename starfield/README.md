# Starfield Visualizer

Static canvas starfield for OBS/browser sources. It runs without a build step and uses synthetic movement until the page is clicked or `M` is pressed, then it tries to use microphone input for bass/mid reactivity.

## Open

```sh
open /Users/jamison/.openclaw/workspace/visualizers/starfield/index.html
```

For OBS Browser Source, use a local server URL if microphone access is needed:

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
http://localhost:8766/visualizers/starfield/?density=1300&speed=1.25&hue=210&trails=0.18
```
