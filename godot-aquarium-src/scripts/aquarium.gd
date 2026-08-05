extends Node2D

const PALETTES := [
	[Color("#ffb35c"), Color("#ff704d"), Color("#fff3b0")],
	[Color("#69e0ff"), Color("#4a8dff"), Color("#e7fbff")],
	[Color("#f86aa8"), Color("#a45cff"), Color("#ffe5f2")],
	[Color("#ffe66d"), Color("#4ecdc4"), Color("#f7fff7")],
	[Color("#ff8f3d"), Color("#d93636"), Color("#fff0c2")],
]

var config := {
	"fish": 18,
	"bubbles": 88,
	"plants": 22,
	"speed": 1.0,
	"hue": 190.0,
	"seed": "default",
}

var rng := RandomNumberGenerator.new()
var fish := []
var bubbles := []
var plants := []
var motes := []
var pebbles := []
var viewport_size := Vector2.ZERO
var elapsed := 0.0

func _ready() -> void:
	RenderingServer.set_default_clear_color(Color("#031018"))
	process_mode = Node.PROCESS_MODE_ALWAYS
	_parse_params()
	_seed_rng()
	_reset_scene()
	get_viewport().size_changed.connect(_on_viewport_size_changed)

func _process(delta: float) -> void:
	elapsed += min(delta, 0.05) * config.speed
	_update_fish(delta)
	_update_bubbles(delta)
	_update_motes(delta)
	queue_redraw()

func _draw() -> void:
	var size := get_viewport_rect().size
	_draw_water(size)
	_draw_backdrop(size)
	_draw_light_rays(size)
	_draw_caustics(size)
	_draw_motes()
	_draw_fish(false)
	_draw_plants(size)
	_draw_bottom(size)
	_draw_fish(true)
	_draw_bubbles()
	_draw_glass(size)

func _parse_params() -> void:
	var query := ""
	if OS.has_feature("web"):
		query = str(JavaScriptBridge.eval("window.location.search || ''", true))
	for pair in query.trim_prefix("?").split("&", false):
		var parts := pair.split("=", true, 1)
		if parts.size() != 2:
			continue
		var key := parts[0]
		var value := parts[1].uri_decode()
		match key:
			"fish":
				config.fish = clampi(int(value), 1, 80)
			"bubbles":
				config.bubbles = clampi(int(value), 0, 260)
			"plants":
				config.plants = clampi(int(value), 0, 60)
			"speed":
				config.speed = clampf(float(value), 0.1, 4.0)
			"hue":
				config.hue = clampf(float(value), 0.0, 360.0)
			"seed":
				config.seed = value

func _seed_rng() -> void:
	rng.seed = hash(str(config.seed))

func _reset_scene() -> void:
	viewport_size = get_viewport_rect().size
	fish.clear()
	bubbles.clear()
	plants.clear()
	motes.clear()
	pebbles.clear()
	for i in config.fish:
		fish.append(_make_fish(i))
	fish.sort_custom(func(a, b): return a.depth < b.depth)
	for i in config.bubbles:
		bubbles.append(_make_bubble(rng.randf_range(0.0, viewport_size.y)))
	for i in config.plants:
		plants.append(_make_plant(i))
	for i in 150:
		motes.append({
			"x": rng.randf_range(0.0, viewport_size.x),
			"y": rng.randf_range(0.0, viewport_size.y),
			"radius": rng.randf_range(0.6, 1.8),
			"drift": rng.randf_range(12.0, 44.0),
			"alpha": rng.randf_range(0.04, 0.14),
		})
	for i in 260:
		pebbles.append(_make_pebble(i))

func _on_viewport_size_changed() -> void:
	var old_size := viewport_size
	var new_size := get_viewport_rect().size
	if old_size.x <= 0.0 or old_size.y <= 0.0:
		_reset_scene()
		return
	var rx := new_size.x / old_size.x
	var ry := new_size.y / old_size.y
	for swimmer in fish:
		swimmer.x *= rx
		swimmer.y *= ry
		swimmer.target_y *= ry
	for bubble in bubbles:
		bubble.x *= rx
		bubble.y *= ry
	for plant in plants:
		plant.x *= rx
		plant.height *= ry
	for mote in motes:
		mote.x *= rx
		mote.y *= ry
	for pebble in pebbles:
		pebble.x *= rx
		pebble.y *= ry
		pebble.radius *= min(rx, ry)
	viewport_size = new_size

func _make_fish(index: int) -> Dictionary:
	var palette = PALETTES[index % PALETTES.size()]
	var lane := rng.randf_range(0.18, 0.72)
	var direction := 1.0 if rng.randf() > 0.5 else -1.0
	return {
		"x": rng.randf_range(0.0, viewport_size.x),
		"y": viewport_size.y * lane,
		"target_y": viewport_size.y * lane,
		"vy": 0.0,
		"direction": direction,
		"facing": direction,
		"speed": rng.randf_range(20.0, 52.0),
		"target_speed": rng.randf_range(20.0, 52.0),
		"scale": rng.randf_range(0.72, 1.22),
		"phase": rng.randf_range(0.0, TAU),
		"wave": rng.randf_range(0.34, 0.82),
		"body": palette[0],
		"fin": palette[1],
		"belly": palette[2],
		"depth": rng.randf_range(0.48, 1.0),
		"tilt": 0.0,
		"turn_cooldown": rng.randf_range(5.0, 18.0),
		"lane_cooldown": rng.randf_range(2.0, 7.0),
		"dart": 0.0,
		"stripe_count": rng.randi_range(2, 5),
		"spot_count": rng.randi_range(0, 4),
	}

func _make_bubble(y: float) -> Dictionary:
	return {
		"x": _bubble_source_x(),
		"y": y,
		"radius": rng.randf_range(2.0, 7.8),
		"speed": rng.randf_range(16.0, 48.0),
		"sway": rng.randf_range(10.0, 34.0),
		"phase": rng.randf_range(0.0, TAU),
		"alpha": rng.randf_range(0.18, 0.42),
	}

func _make_plant(index: int) -> Dictionary:
	var denom = max(config.plants - 1, 1)
	var x := (float(index) / float(denom)) * viewport_size.x + rng.randf_range(-viewport_size.x * 0.04, viewport_size.x * 0.04)
	return {
		"x": clampf(x, 26.0, viewport_size.x - 26.0),
		"height": viewport_size.y * rng.randf_range(0.12, 0.3),
		"sway": rng.randf_range(0.45, 1.05),
		"hue": rng.randf_range(132.0, 174.0),
		"fronds": rng.randi_range(3, 7),
		"phase": rng.randf_range(0.0, TAU),
	}

func _make_pebble(index: int) -> Dictionary:
	var band := rng.randf_range(0.86, 0.985)
	var shade := rng.randf_range(0.18, 0.42)
	return {
		"x": rng.randf_range(-20.0, viewport_size.x + 20.0),
		"y": viewport_size.y * band,
		"radius": rng.randf_range(1.2, 5.8) * lerpf(0.65, 1.25, band),
		"flatness": rng.randf_range(0.38, 0.72),
		"color": Color(shade * 0.72, shade * 0.88, shade, rng.randf_range(0.16, 0.34)),
	}

func _update_fish(delta: float) -> void:
	var size := viewport_size
	for swimmer in fish:
		swimmer.phase += delta * (1.8 + swimmer.wave)
		swimmer.turn_cooldown -= delta
		swimmer.lane_cooldown -= delta
		if swimmer.turn_cooldown <= 0.0:
			if rng.randf() < 0.32:
				swimmer.direction *= -1.0
			swimmer.target_speed = rng.randf_range(16.0, 56.0)
			swimmer.dart = rng.randf_range(0.0, 18.0) if rng.randf() < 0.22 else 0.0
			swimmer.turn_cooldown = rng.randf_range(4.5, 13.0)
		if swimmer.lane_cooldown <= 0.0:
			var drift := sin(elapsed * 0.17 + swimmer.phase) * size.y * 0.08
			swimmer.target_y = clampf(size.y * rng.randf_range(0.16, 0.74) + drift, size.y * 0.1, size.y * 0.8)
			swimmer.lane_cooldown = rng.randf_range(3.0, 8.5)
		swimmer.facing = lerpf(swimmer.facing, swimmer.direction, min(1.0, delta * 3.0))
		swimmer.speed = lerpf(swimmer.speed, swimmer.target_speed + swimmer.dart, min(1.0, delta * 0.7))
		swimmer.dart = max(0.0, swimmer.dart - delta * 10.0)
		var idle_wave := sin(elapsed * swimmer.wave + swimmer.phase) * size.y * 0.016
		var vertical_goal: float = swimmer.target_y + idle_wave
		var desired_vy: float = clampf((vertical_goal - swimmer.y) * 0.42, -42.0, 42.0)
		swimmer.vy = lerpf(swimmer.vy, desired_vy, min(1.0, delta * 1.8))
		swimmer.x += swimmer.speed * swimmer.facing * delta * config.speed
		swimmer.y += swimmer.vy * delta * config.speed
		swimmer.y = clampf(swimmer.y, size.y * 0.08, size.y * 0.82)
		var horizontal = max(swimmer.speed * abs(swimmer.facing), 28.0)
		var target_tilt := clampf(atan2(swimmer.vy, horizontal), -0.28, 0.28) * 0.78
		swimmer.tilt = lerpf(swimmer.tilt, target_tilt, min(1.0, delta * 4.0))
		var margin: float = 110.0 * swimmer.scale
		if swimmer.direction > 0.0 and swimmer.x > size.x + margin:
			swimmer.direction = -1.0
			swimmer.x = size.x + margin
			swimmer.target_y = size.y * rng.randf_range(0.17, 0.74)
		elif swimmer.direction < 0.0 and swimmer.x < -margin:
			swimmer.direction = 1.0
			swimmer.x = -margin
			swimmer.target_y = size.y * rng.randf_range(0.17, 0.74)

func _update_bubbles(delta: float) -> void:
	for bubble in bubbles:
		bubble.phase += delta * 1.4
		bubble.y -= bubble.speed * delta * config.speed
		bubble.x += sin(bubble.phase) * bubble.sway * delta
		if bubble.y < -bubble.radius * 4.0:
			var fresh := _make_bubble(viewport_size.y + bubble.radius * 4.0)
			for key in fresh:
				bubble[key] = fresh[key]

func _update_motes(delta: float) -> void:
	for mote in motes:
		mote.y -= mote.drift * delta * config.speed
		mote.x += sin(elapsed * 0.24 + mote.y * 0.014) * 5.4 * delta
		if mote.y < -4.0:
			mote.y = viewport_size.y + 4.0
			mote.x = rng.randf_range(0.0, viewport_size.x)

func _draw_water(size: Vector2) -> void:
	var top := Color.from_hsv(config.hue / 360.0, 0.76, 0.24)
	var mid := Color.from_hsv(fmod(config.hue + 4.0, 360.0) / 360.0, 0.76, 0.14)
	var bottom := Color.from_hsv(fmod(config.hue + 12.0, 360.0) / 360.0, 0.7, 0.06)
	var bands := 96
	for i in bands:
		var t := float(i) / float(bands - 1)
		var color := top.lerp(mid, smoothstep(0.0, 0.5, t)) if t < 0.5 else mid.lerp(bottom, smoothstep(0.5, 1.0, t))
		color = color.darkened(t * 0.18)
		draw_rect(Rect2(0.0, size.y * t, size.x, ceil(size.y / bands) + 1.0), color)
	for i in 10:
		var y := size.y * (0.08 + i * 0.06) + sin(elapsed * 0.28 + i) * 9.0
		draw_rect(Rect2(0.0, y - 1.0, size.x, 2.0), Color(0.55, 0.92, 1.0, 0.018))

func _draw_backdrop(size: Vector2) -> void:
	for i in 8:
		var x := size.x * (0.08 + i * 0.13) + sin(float(i) * 1.7) * size.x * 0.025
		var h := size.y * (0.28 + fmod(float(i) * 0.17, 0.22))
		var w := size.x * (0.055 + fmod(float(i) * 0.013, 0.035))
		var points := PackedVector2Array([
			Vector2(x - w, size.y * 0.86),
			Vector2(x - w * 0.35, size.y * 0.54),
			Vector2(x, size.y * 0.86 - h),
			Vector2(x + w * 0.32, size.y * 0.55),
			Vector2(x + w, size.y * 0.86),
		])
		draw_colored_polygon(points, Color(0.01, 0.06, 0.07, 0.26))
	for i in 6:
		var center := Vector2(size.x * (0.04 + i * 0.18), size.y * (0.9 + fmod(i * 0.07, 0.05)))
		draw_filled_ellipse(center, Vector2(size.x * 0.055, size.y * 0.025), Color(0.03, 0.08, 0.09, 0.28))

func _draw_light_rays(size: Vector2) -> void:
	for i in 7:
		var top_x := size.x * (0.1 + i * 0.14) + sin(elapsed * 0.12 + i) * 42.0
		var bottom_x := top_x + sin(elapsed * 0.18 + i * 1.7) * 170.0
		var points := PackedVector2Array([
			Vector2(top_x - 36.0, 0.0),
			Vector2(top_x + 54.0, 0.0),
			Vector2(bottom_x + 135.0, size.y),
			Vector2(bottom_x - 112.0, size.y),
		])
		draw_colored_polygon(points, Color(0.62, 0.95, 1.0, 0.035))

func _draw_caustics(size: Vector2) -> void:
	for band in 5:
		var y := size.y * (0.16 + band * 0.08)
		var points := PackedVector2Array()
		for step in 50:
			var x := size.x * float(step) / 49.0
			var wave := sin(elapsed * 0.34 + step * 0.45 + band) * 5.0 + sin(elapsed * 0.21 + step * 0.18) * 3.0
			points.append(Vector2(x, y + wave))
		draw_polyline(points, Color(0.72, 0.98, 1.0, 0.035), 1.2, true)

func _draw_motes() -> void:
	for mote in motes:
		draw_circle(Vector2(mote.x, mote.y), mote.radius, Color(0.8, 0.98, 1.0, mote.alpha))

func _draw_fish(front: bool) -> void:
	for swimmer in fish:
		if front and swimmer.depth < 0.76:
			continue
		if not front and swimmer.depth >= 0.76:
			continue
		_draw_single_fish(swimmer)

func _draw_single_fish(swimmer: Dictionary) -> void:
	var alpha = 0.42 + clampf((swimmer.depth - 0.48) / 0.52, 0.0, 1.0) * 0.58
	var facing = swimmer.facing
	if abs(facing) < 0.06:
		facing = 0.06 if facing >= 0.0 else -0.06
	var transform := Transform2D(swimmer.tilt, Vector2(swimmer.x, swimmer.y)).scaled(Vector2(facing, 1.0))
	draw_set_transform_matrix(transform)
	var s: float = 42.0 * swimmer.scale * swimmer.depth
	var tail := sin(swimmer.phase * 2.4) * 0.38
	draw_colored_polygon(PackedVector2Array([
		Vector2(-0.52 * s, 0.0),
		Vector2(-0.9 * s, (-0.48 - tail) * s),
		Vector2(-0.82 * s, (0.48 - tail) * s),
	]), _with_alpha(swimmer.fin, alpha))
	draw_colored_polygon(PackedVector2Array([
		Vector2(-0.08 * s, -0.28 * s),
		Vector2(-0.42 * s, -0.72 * s),
		Vector2(-0.28 * s, -0.05 * s),
	]), _with_alpha(swimmer.fin, alpha * 0.8))
	draw_colored_polygon(PackedVector2Array([
		Vector2(-0.04 * s, 0.22 * s),
		Vector2(-0.26 * s, 0.58 * s),
		Vector2(0.16 * s, 0.26 * s),
	]), _with_alpha(swimmer.fin.darkened(0.1), alpha * 0.5))
	draw_filled_ellipse(Vector2.ZERO, Vector2(0.66 * s, 0.34 * s), _with_alpha(swimmer.body, alpha))
	draw_filled_ellipse(Vector2(0.1 * s, -0.1 * s), Vector2(0.3 * s, 0.11 * s), Color(1.0, 1.0, 1.0, alpha * 0.16))
	var pattern_color := _with_alpha(swimmer.fin.darkened(0.28), alpha * 0.34)
	for i in swimmer.stripe_count:
		var x := lerpf(-0.34 * s, 0.22 * s, float(i) / max(float(swimmer.stripe_count - 1), 1.0))
		draw_line(Vector2(x, -0.23 * s), Vector2(x + 0.06 * s, 0.22 * s), pattern_color, max(1.0, 0.025 * s), true)
	for i in swimmer.spot_count:
		var angle: float = float(i) * 2.4 + swimmer.phase
		var spot := Vector2(cos(angle) * 0.26 * s - 0.04 * s, sin(angle * 1.3) * 0.14 * s)
		draw_circle(spot, max(1.3, 0.032 * s), Color(0.02, 0.04, 0.04, alpha * 0.22))
	draw_line(Vector2(0.28 * s, -0.22 * s), Vector2(0.26 * s, 0.18 * s), Color(0.02, 0.05, 0.05, alpha * 0.26), max(1.0, 0.018 * s), true)
	draw_circle(Vector2(0.42 * s, -0.09 * s), max(1.8, 0.045 * s), Color(0.02, 0.06, 0.08, alpha))
	draw_circle(Vector2(0.435 * s, -0.105 * s), max(0.5, 0.012 * s), Color(1.0, 1.0, 1.0, alpha * 0.8))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _draw_plants(size: Vector2) -> void:
	for plant in plants:
		for i in plant.fronds:
			var spread: float = (i - (plant.fronds - 1) * 0.5) * 8.0
			var root := Vector2(plant.x + spread, size.y - 26.0)
			var height: float = plant.height * (0.76 + float(i) / max(float(plant.fronds), 1.0) * 0.34)
			var sway := sin(elapsed * plant.sway + plant.phase + i * 0.7) * 22.0
			var tip := root + Vector2(sway * 0.7, -height)
			var ctrl1 := root + Vector2(-12.0, -height * 0.35)
			var ctrl2 := root + Vector2(sway, -height * 0.74)
			var curve := Curve2D.new()
			curve.add_point(root)
			curve.add_point(tip, tip - ctrl2, ctrl1 - root)
			var points := curve.tessellate(6, 4)
			var color := Color.from_hsv(fmod(plant.hue + i * 4.0, 360.0) / 360.0, 0.62, 0.34 + i * 0.03, 0.78)
			draw_polyline(points, color, 4.2 + i * 0.45, true)

func _draw_bottom(size: Vector2) -> void:
	for i in 24:
		var t := float(i) / 23.0
		var color := Color("#143e42").lerp(Color("#07181d"), t)
		draw_rect(Rect2(0.0, size.y * (0.84 + t * 0.16), size.x, size.y * 0.16 / 23.0 + 1.0), color)
	for pebble in pebbles:
		draw_filled_ellipse(Vector2(pebble.x, pebble.y), Vector2(pebble.radius, pebble.radius * pebble.flatness), pebble.color)
	var rocks := [
		[0.1, 0.91, 52.0, 24.0],
		[0.17, 0.94, 82.0, 34.0],
		[0.72, 0.92, 64.0, 26.0],
		[0.81, 0.95, 110.0, 42.0],
		[0.9, 0.91, 58.0, 22.0],
	]
	for rock in rocks:
		draw_filled_ellipse(Vector2(size.x * rock[0], size.y * rock[1]), Vector2(rock[2], rock[3]), Color("#203b43"))
		draw_filled_ellipse(Vector2(size.x * rock[0] - rock[2] * 0.18, size.y * rock[1] - rock[3] * 0.24), Vector2(rock[2] * 0.45, rock[3] * 0.28), Color(0.46, 0.64, 0.68, 0.24))

func _draw_bubbles() -> void:
	for bubble in bubbles:
		var color := Color(0.68, 0.94, 1.0, bubble.alpha)
		draw_arc(Vector2(bubble.x, bubble.y), bubble.radius, 0.0, TAU, 24, color, 1.5, true)
		draw_circle(Vector2(bubble.x - bubble.radius * 0.24, bubble.y - bubble.radius * 0.26), bubble.radius * 0.18, Color(1.0, 1.0, 1.0, bubble.alpha * 1.4))

func _draw_glass(size: Vector2) -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.0, 0.0, 0.0, 0.16), false, 12.0)
	for i in 5:
		var x := size.x * (0.16 + i * 0.18)
		draw_filled_ellipse(Vector2(x, size.y * 0.48), Vector2(14.0, size.y * 0.56), Color(1.0, 1.0, 1.0, 0.025))
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.0, 0.0, 0.0, 0.18), false, 2.0)

func _bubble_source_x() -> float:
	var sources := [0.08, 0.38, 0.57, 0.86]
	if rng.randf() < 0.72:
		return viewport_size.x * sources[rng.randi_range(0, sources.size() - 1)] + rng.randf_range(-36.0, 36.0)
	return rng.randf_range(0.0, viewport_size.x)

func draw_filled_ellipse(center: Vector2, radius: Vector2, color: Color) -> void:
	var points := PackedVector2Array()
	for i in 32:
		var angle := TAU * float(i) / 32.0
		points.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y))
	draw_colored_polygon(points, color)

func _with_alpha(color: Color, alpha: float) -> Color:
	return Color(color.r, color.g, color.b, alpha)
