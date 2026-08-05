# Virtual Fish Tank

Static canvas aquarium for OBS/browser sources. It runs without a build step and keeps motion slow enough for background use.

Hosted URL:

```text
https://jvmisxn.github.io/jmo-visualizers/fish-tank/
```

## URL Parameters

- `fish=16` number of fish
- `bubbles=72` bubble count
- `plants=18` plant clusters
- `speed=1` overall fish speed
- `hue=190` water color hue
- `fps=30` frame cap for lower CPU
- `dpr=1` backing-store scale override for OBS parity
- `seed=name` keeps layout deterministic across reloads
- `quality=low` disables floating motes

Example:

```text
https://jvmisxn.github.io/jmo-visualizers/fish-tank/?fish=20&bubbles=96&speed=0.8&dpr=1&fps=30
```
