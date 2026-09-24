# How the v2 "operations console" wireframe was built

_2026-09-24. How the clickable console mock works (the spinning GLOBE and the RADAR 2D scan), so the
real build can reuse the ideas. Wireframe: https://claude.ai/artifact/6AxoScn1r6AFfx1Ngz8AgW
(private; row 2). Source files, copied verbatim: `project-docs/redesign-ux/_reference/wireframe-2026-09-24/`
(`Console.dc.html` = globe mode with the switch, `ConsoleRadar.dc.html` = same component opening in
radar mode). Decisions behind it: `HOME_MAP_BRIEFINGS_DESIGN_BRIEF.md` round 2._

**Important:** this is a *mock*, built to decide the look and behaviour, not production code. It
runs as a "Design Component" (`.dc.html`: HTML markup + one small JS class) on a design canvas.
Everything is plain SVG, CSS and a timer. The production globe will use the existing deck.gl
globe (`src/features/map/components/SituationMap3D.jsx`), as §7 explains.

---

## 1. The page layout (the "HUD")

A dark full-screen frame (1440×900), with a faint 48 px cyan grid behind everything (two
`linear-gradient`s on one layer). Panels float over the map with `position: absolute`:

| Panel | Where | What it shows |
|---|---|---|
| Situation brief | top-left | today's lead story |
| Threat board | top-centre | counts by severity tier (high / elevated / moderate / low) |
| Sensor status | top-right | freshness per data source, e.g. GDACS LIVE 56m, news desk PAUSED since 13 Sep |
| Intel feed | right column | the story list, linked to the map pins |
| Incoming alert | left, under the brief | a dismissible new-alert card |
| View / Layer bar | bottom-left | GLOBE · RADAR 2D · stop/resume, then the layer toggles |

Panels use a translucent navy (`rgba(8,16,26,0.78)`), a thin cyan border, and two small corner
brackets (12 px L-shapes from `border-left/top` and `border-right/bottom`), which gives the
sci-fi feel. Type: JetBrains Mono for HUD labels, Fraunces for headlines, and the four existing
crisis-type colours (conflict `#ee7754`, political `#9b8cf8`, economic `#38b6de`, humanitarian
`#d89e28`).

## 2. The GLOBE mode: drawing a sphere with nothing but SVG

**Orthographic projection** (how a globe looks from far away). For a point at longitude `λ`,
latitude `φ`, with the view centred on `λ0, φ0` (radius `R`, centre `C`):

```
cos c = sin φ0 · sin φ + cos φ0 · cos φ · cos(λ − λ0)     // > 0 means the point faces us
x = C + R · cos φ · sin(λ − λ0)
y = C − R · (cos φ0 · sin φ − sin φ0 · cos φ · cos(λ − λ0))
```

In the code this is `proj(lonDeg, latDeg) → { x, y, front }`. Every point is only drawn when
`front` is true, so things on the far side disappear behind the globe.

The sphere is layered back to front:
1. **Halo:** a circle slightly larger than the globe, filled with a radial gradient that is
   transparent in the middle and glows cyan at the rim (the "atmosphere").
2. **Body:** the globe circle, with a radial gradient lit from the upper left (`cx=38% cy=34%`),
   which fakes 3D shading.
3. **Graticule:** latitude and longitude lines. Walk each line in 5° steps, project every point,
   and build ONE SVG path string. The pen lifts (a new `M`) whenever the line goes behind the
   globe, so lines never draw across the back.
4. **Dots:** "land" as a point cloud. The grid is sampled every 8°, and each visible point is
   drawn as `M x y h0.1` with `stroke-linecap: round`, so each tiny segment renders as a round dot.
   All dots are one path, which keeps it fast. **The land test in the mock is a fake wavy
   function**; the real build uses real coastlines (§7).
5. **Pins:** real story locations (`lon/lat`) projected with the same `proj()`, drawn as
   absolutely positioned buttons on top of the SVG (real `<button>`s, so they're keyboard-reachable):
   - a **live situation** is a solid dot with a glow and a CSS pulse ring (`@keyframes gp-pulse`);
   - a **story with no live situation** is a dashed ring on its country.

**Spinning.** A timer (`setInterval`, every 80 ms) adds 0.9° to `λ0` and re-renders. Because
everything is re-projected from `λ0`, the whole globe (lines, dots, pins) turns together, and
pins naturally rise over the edge and disappear behind it.
- **Selecting a story stops the spin** and sets `λ0` to that story's longitude, so the globe
  turns to face it, and a callout appears beside the pin. Deselecting resumes the spin.
- The "STOP SPIN / ▶ SPIN" button toggles a `moving` flag the timer checks.

## 3. The RADAR 2D mode: the scanning beam

**The flat map.** An equirectangular projection (the simplest one: `x = (lon + 180) / 360 × W`,
`y = (90 − lat) / 180 × H`) in an 840×420 panel, with a square grid and the same dot "land", plus
three faint range rings around the centre for the radar look.

**The beam.** One big circle (940 px, centred on the map centre) whose background is a CSS
`conic-gradient`. Its start angle follows the sweep angle every tick:

```
conic-gradient(from (sweep + 90 − 40)deg,
  transparent 0deg,
  cyan 26% at 39deg,        // the trail brightens toward the leading edge
  bright cyan at 40deg,     // the leading edge (a thin bright line)
  transparent at 40.6deg)
```

The `+90` converts between the two angle conventions: screen maths measures angles from "east",
CSS conic gradients measure from "north". The timer adds 3° per tick, so one full sweep takes
about 10 seconds.

**Detecting what the beam just crossed.** For every pin, compute its bearing from the map centre
once, `angle = atan2(y − centreY, x − centreX)` in degrees from 0 to 360. Then, each tick:

```
behind = (sweep − angle + 360) % 360     // how far the beam has passed this pin
scanned = behind < 40                    // inside the 40° trail
glow    = 1 − behind / 40                // 1 right after the beam passes, fading to 0
```

While `scanned`:
- the pin goes to full opacity, with a glow whose size scales with `glow`;
- a short label appears beside it (e.g. "INDIA · CYCLONE"), fading as `glow` falls;
- its story in the Intel feed gets a subtle ◉ SCANNED marker and highlight. **It never scrolls
  the feed or moves keyboard focus.** That is deliberate, so the scan can't hijack a reader.

`ConsoleRadar.dc.html` starts with `sweep = 355°` so the static picture already shows the beam
just past India (lit brightly) and Saudi Arabia (fading), without pressing Play.

## 4. Linked selection (feed ↔ map)

One piece of state, `selected`, holds the chosen story's id. Both the feed rows and the pins
call the same `pick()`:
- the feed row gets a cyan left bar and a highlight;
- in globe mode, the globe turns to face the story (see §2) and shows the callout;
- in radar mode, the pin and its label stay lit regardless of the beam.

In the real build this state lives in the URL (`/?story=<id>&view=globe|radar`), per the
frontend design (`HOME_MAP_BRIEFINGS_FRONTEND_DESIGN.md` §5 + §12).

## 5. Motion safety

- On start, the component checks `matchMedia('(prefers-reduced-motion: reduce)')`. If it
  matches, `moving` starts false: a still globe, and a radar with no beam.
- CSS pulses sit behind `@media (prefers-reduced-motion: reduce) { animation: none }`.
- The stop/resume button gives everyone control over motion.

## 6. Honesty rules the mock encodes

- **Sensor status** shows real freshness per source (GDACS live, news desk paused since 13 Sep).
  The console never claims "live" for stale inputs.
- The radar is a *way of looking*, not a live detector. It re-scans what the data already
  contains and invents nothing.
- Anything the backend can't supply yet is shown as `[placeholder]`, never a made-up number.

## 7. From mock to real build

| Mock technique | Real build |
|---|---|
| SVG orthographic globe, fake "land" function | The existing **deck.gl globe** (`SituationMap3D.jsx`) with **real Earth**: dotted real landmass (GitHub-globe style: land sampled from real coastlines, drawn as instanced dots + a halo shader) or NASA **Black Marble** night-lights imagery. See the brief, round 2, item 5. |
| `setInterval` spin | deck.gl view-state animation (`requestAnimationFrame`), paused on user interaction, with no re-render of React per frame. |
| CSS conic-gradient radar | Same technique (it's cheap). The radar mode uses the existing 2D map, so phones and slow devices never load the 3D engine. |
| Bearing + trail window "scan" | Same maths, computed once per pin; the highlight state is derived per animation frame. |
| All pins re-rendered each tick | Pins as a deck.gl layer (globe) or SVG (radar); only the glow and opacity attributes update. |
| Frame rate | Adaptive quality like GitHub's globe: if FPS drops, reduce dot density, turn off the halo, then fall back to radar. |
| Load order | Page shell + Intel feed first; the globe loads right after (lazy chunk); Earth texture last. |
