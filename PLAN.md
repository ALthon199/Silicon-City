# Silicon City — City Skylines Rebuild Plan

> Saved: 2026-04-22. Answers collected from user before implementation began.

---

## User Design Decisions

| Question | Answer |
|---|---|
| Gate style | Modernize: keep arch shape, replace stone/ornament with concrete + steel |
| Perimeter walls | Remove entirely — city fades into green ground |
| Building type | Map extensions to building archetypes (5 types) |
| Road detail | Full treatment (lane markings, sidewalks, crosswalks, trees) — but performance-first |
| Windows | Keep simple (2-pane approach), improve positioning and brightness |

---

## Building Archetypes

| Archetype | Extensions | Form | Character |
|---|---|---|---|
| **office** | js, jsx, ts, tsx, py, go, rs, c, cpp, java, rb, php, swift, kt, cs | 3-tier setback tower | Tall, slim, glass curtain-wall look |
| **civic** | json, yaml, yml, toml, xml, env, ini, cfg, conf, lock, sh | Single block, square | Columns on facade, parapet, flag pole |
| **commercial** | html, css, scss, md, txt, rst, csv | Short, wide | Awning, sign band, ground-floor retail |
| **residential** | png, jpg, jpeg, svg, gif, ico, webp, bmp | Medium, grid balconies | Balcony rows, roof parapet |
| **industrial** | mp4, mov, avi, mkv, mp3, wav, wasm, bin, exe | Low, very wide | Stepped roof ridges, loading dock |
| **default** | anything else | Generic mid-rise | Simple slab |

All color coding by exact extension stays unchanged.

---

## Road Infrastructure (performance-first: InstancedMesh only)

| Element | Geometry | Count | Draw calls |
|---|---|---|---|
| Center dashes (N-S + E-W) | 1.0 × 0.04 × 0.15 box | ~230 | 1 |
| Sidewalk strips (lot edges) | LOT_SIZE × 0.07 × 0.5 box | 64 | 1 |
| Corner crosswalks | 4.0 × 0.04 × 0.2 box | 40 | 1 |
| Boulevard trees (trunks) | 0.26 × 1.36 × 0.26 box | 20 | 1 |
| Boulevard trees (canopy) | instanced spheroids | 20×3 | 3 |

Total new draw calls for roads: ~7

---

## Files Changed

| File | Scope | Key changes |
|---|---|---|
| `Building.jsx` | Major | Archetype system, 5 form renderers, deterministic windows |
| `CityBoundary.jsx` | Major | Remove WallSection/CornerTower/InnerRoundabout, add road package |
| `Gate.jsx` | Major | Concrete piers + steel arch, LED strip, modern sign, remove Roman ornament |
| `EntranceGate.jsx` | Major | Same modern arch, golden accent, grand proportions |
| `Ground.jsx` | None | Kept as-is |
| `PlotGrid.jsx` | None | Kept as-is |
| `gridLayout.js` | None | Grid math unchanged |

---

## Geometry Correctness Rules

- Road dashes at y=0.17 (above asphalt top y=0.16, below lot slab y=0.36) — no z-fight
- Sidewalk strips at y=0.20 — placed in road corridor, adjacent to lot edge ± 0.25 units
- All new meshes: `raycast={() => null}` unless interactive
- Building cap per archetype: w, d capped at 7.4 (LOT_SIZE - 0.3 margin each side)
- Gate piers sized to GATE_SPAN=6.0 — piers at ±PIER_CX from gate center = 0 overlap with gap
- Corner towers: REMOVED (no walls means no corner anchors needed)

---

## Shared Constants (must stay in sync)

```
SLAB_TOP = 0.36          Building.jsx, CityBoundary.jsx
BUILDER_TTL = 4400       CityScene.jsx ↔ Builder.jsx
DUST_TTL = 1400          CityScene.jsx ↔ DustCloud.jsx
GATE FULL_W = 6.0        Gate.jsx ↔ EntranceGate.jsx ↔ CityBoundary wall-gap
```
