# Godot Aquarium

Godot 4.7 web-export comparison build for the canvas fish tank.

## Local Run

```sh
godot --path godot-aquarium-src
```

## Export

```sh
mkdir -p godot-aquarium
godot --headless --path godot-aquarium-src --export-release Web ../godot-aquarium/index.html
```

## URL Params

- `fish=18` fish count, clamped from 1 to 80
- `bubbles=90` bubble count, clamped from 0 to 260
- `plants=20` plant count, clamped from 0 to 60
- `speed=1` motion speed, clamped from 0.1 to 4
- `hue=190` water hue, clamped from 0 to 360
- `seed=obs` deterministic layout
