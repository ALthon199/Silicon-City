# Silicon City — Spec vs. Implementation Review

> Evaluated: 2026-04-23  
> Spec source: `PLAN.md` (saved 2026-04-22)

---

## Summary

The implementation covers almost every item in the spec and exceeds it in several meaningful ways. Two gaps exist: the boulevard trees are unbuilt, and one shared constant drifted from its spec value.

---

## Spec Compliance — Item by Item

### 1. Gate Style — Modernize (concrete + steel)

| Spec | Status |
|---|---|
| Replace stone/ornament with concrete + steel | ✅ `Gate.jsx` — `matConcrete` (#454550), `matSteel` (#606870) |
| Keep arch shape | ✅ 7-segment semicircular arch, radius = 1.5 |
| LED accent strip | ✅ Per-segment LED mesh on inner arch face, opacity-animated on hover |
| Modern directory name sign | ✅ Dark sign panel + coloured accent strip + `<Text>` label |
| Remove Roman ornament | ✅ No columns, no decorative stone anywhere in `Gate.jsx` |
| `FULL_W = 6.0` in sync across files | ✅ Gate, EntranceGate, CityBoundary all use `FULL_W = 6.0` / `PIER_CX = 2.25` |

**EntranceGate** — warm gold palette (`#c8a040`), beacon crown light, dims to grey at root, Back/Root label reacts to `cwd`. All correct.

---

### 2. Perimeter Walls

| Spec | Status |
|---|---|
| Remove walls entirely | ✅ `CityBoundary.jsx` has no `WallSection`, `CornerTower`, or `InnerRoundabout` |
| City fades into green ground | ✅ Asphalt base 108×108, green `Ground` plane extends beyond |

---

### 3. Building Archetypes

All six archetypes are implemented in `Building.jsx` and match the spec forms.

| Archetype | Form (spec) | Implemented | Extensions match spec |
|---|---|---|---|
| **office** | 3-tier setback glass tower | ✅ Tiers at 55%/28%/17%, setback slabs, floor belts | ✅ + extras (dart, lua, scala, clj, ex, exs) |
| **civic** | Square block, parapet, flag pole | ✅ Dense belts, 3 pilasters, 4-sided parapet, red/white flag | ✅ + extras (bash, zsh, fish, dockerfile, gitignore…) |
| **commercial** | Short wide, awning, sign band | ✅ `wScale=1.30`, awning with 3 supports, sign band + accent | ✅ + extras (less, sass, tsv, log) |
| **residential** | Medium, balcony rows, parapet | ✅ Balcony slabs + railings every 1.4 units, thin 4-sided parapet | ✅ + extras (tiff, psd, ai, fig) |
| **industrial** | Low very wide, stepped ridges, dock | ✅ `wScale=1.45`, 3 stepped roof ridges, loading dock + apron + bumper | ✅ + extras (ogg, flac, dll, dylib, zip, gz…) |
| **default** | Generic mid-rise slab | ✅ Plain box + floor belts + roof cap | N/A |

Extension extras are all reasonable expansions of each category and don't conflict.

---

### 4. Road Infrastructure (performance-first: InstancedMesh only)

| Element | Spec | Implemented |
|---|---|---|
| Center dashes (N-S + E-W) | ~230 instances, 1 draw call | ✅ `RoadMarkings` — InstancedMesh, ~774 dashes, y=0.17, 1 draw call |
| Sidewalk strips | 64 strips, 1 draw call | ✅ `Sidewalks` — InstancedMesh, LOT_SIZE×0.07×0.5, y=0.20, 1 draw call |
| Corner crosswalks | 40 stripes, 1 draw call | ✅ `CrosswalkStripes` — InstancedMesh, 5 stripes × 8 gate positions, y=0.18, 1 draw call |
| **Boulevard trees (trunks)** | 20 instances, 1 draw call | ❌ **Not implemented** |
| **Boulevard trees (canopy)** | 20×3 spheroids, 3 draw calls | ❌ **Not implemented** |

The road package currently costs ~4 draw calls instead of the spec's ~7. The missing boulevard trees are the only unbuilt road element.

---

### 5. Windows

| Spec | Status |
|---|---|
| Keep simple (2-pane approach) | ✅ 2 south-face panes + 1 east-face pane |
| Improved y positioning | ✅ `yPos = Math.max(0.8, height * 0.44)` (upper-middle) |
| Improved brightness | ✅ Flicker via `sin` oscillator, `_winDark` → `_winBright` lerp |

---

### 6. Geometry Correctness Rules

| Rule | Spec value | Code value | Status |
|---|---|---|---|
| Road dashes Y | 0.17 | `_dummy.position.set(rx, 0.17, z)` | ✅ |
| Sidewalk strips Y | 0.20 | `_dummy.position.set(x, 0.20, …)` | ✅ |
| Crosswalk stripes Y | between dashes and sidewalks | y=0.18 | ✅ |
| Non-interactive meshes `raycast` | `() => null` | Consistently applied | ✅ |
| Building footprint cap | 7.4 (LOT_SIZE − 0.3 each side) | `Math.min(base * wScale, 7.4)` | ✅ |
| Gate piers no overlap | PIER_CX = HW + PIER_W/2 | 1.5 + 0.75 = 2.25 ✅ | ✅ |
| Corner towers removed | N/A | Not present | ✅ |

---

### 7. Shared Constants

| Constant | Spec value | Code value | Status |
|---|---|---|---|
| `SLAB_TOP` | 0.36 | `Building.jsx` line 160: `0.36`; `CityBoundary.jsx` line 42: `SLAB_Y + SLAB_H/2 = 0.36` | ✅ |
| `BUILDER_TTL` | 4400 ms | `CityScene.jsx` line 20: `4400` | ✅ |
| `DUST_TTL` | **1400 ms** | `CityScene.jsx` line 21: **`2400`** | ❌ **Mismatch** |
| `GATE FULL_W` | 6.0 | Both gates: 6.0 | ✅ |

The `DUST_TTL` discrepancy means demolition dust clouds linger ~1 second longer than the spec intended. Check whether `DustCloud.jsx`'s internal `TOTAL_MS` matches 2400 or 1400.

---

## Files Changed vs. Spec

| File | Spec scope | Actual scope | Delta |
|---|---|---|---|
| `Building.jsx` | Major | Major | ✅ On scope + rooftop variety bonus |
| `CityBoundary.jsx` | Major (remove walls, add roads) | Major | ⚠️ Walls removed, roads done, trees missing |
| `Gate.jsx` | Major | Major | ✅ |
| `EntranceGate.jsx` | Major | Major | ✅ |
| `Ground.jsx` | None (kept as-is) | None | ✅ |
| `PlotGrid.jsx` | None (kept as-is) | None | ✅ |
| `gridLayout.js` | None (unchanged) | None | ✅ |

---

## Beyond Spec — Bonus Features

The following are not in `PLAN.md` but are implemented and working:

| Feature | File(s) | Notes |
|---|---|---|
| Animated grand central fountain | `CityBoundary.jsx` | 25 animated water jets, 3 tiers, parabolic arcs, rotating crown |
| Park lots | `CityBoundary.jsx` | 4 lots with grass, hedges, benches, flower beds |
| Portal scene through gate | `PortalScene.jsx`, `Gate.jsx`, `EntranceGate.jsx` | Night-city silhouette visible in arch opening |
| Construction animation | `Builder.jsx` | Appears before new building, times out at `BUILDER_TTL` |
| Demolition particles | `DustCloud.jsx` | Triggered by `rm` pre-remove event |
| Citizen NPC | `Citizen.jsx` | Animated character in the city |
| Breadcrumb navigation | `Breadcrumb.jsx` | Displays current path |
| File tree sidebar | `FileTreePanel.jsx` | Clickable tree panel |
| Extended terminal commands | `TerminalHUD.jsx` | `mv`, `cp`, `cat`, `pwd`, `clear`, Tab autocomplete, history |
| Rooftop variety | `Building.jsx` | Water towers, antennas, roof gardens, satellite dishes, HVAC — all deterministic |
| Building hover inspect | `Building.jsx` | Click dispatches `vfs-inspect` with name/ext/size |
| GSAP city exit animation | `CityScene.jsx` | Staggered scale-out on `cd`, then scene switch |

---

## Issues to Fix

### P1 — `DUST_TTL` constant mismatch
**Location:** `CityScene.jsx` line 21  
**Current:** `const DUST_TTL = 2400`  
**Spec:** `DUST_TTL = 1400`  
Verify the actual lifespan in `DustCloud.jsx` and reconcile all three values (spec, `CityScene`, `DustCloud`).

### P2 — Boulevard trees not built
**Location:** `CityBoundary.jsx` — add two InstancedMesh components  
**Spec requirement:**
- 20 trunk instances — `0.26 × 1.36 × 0.26` box, 1 draw call
- 60 canopy spheroid instances across 3 InstancedMeshes (3 draw calls)
- Place along N-S and E-W boulevard edges

---

## Overall Verdict

**~95% spec-complete.** Every structural decision from the user Q&A is correctly reflected in the code. The modernized gates, 5-archetype building system, road package, and geometry correctness rules are all solid. The two remaining gaps are the boulevard trees (unbuilt) and the `DUST_TTL` drift. The bonus features — fountain, park lots, portal scenes, construction/demolition animations — meaningfully exceed the spec without conflicting with any of its requirements.
