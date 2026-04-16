/**
 * City Layout Engine — City Block Platform
 *
 * Design: each file slot is a raised 8×8 concrete slab (the "lot").
 * Roads are the gaps between slabs — filled by a single asphalt base mesh.
 * This eliminates all intersection z-fighting.
 *
 * ─── Lot grid ────────────────────────────────────────────────────
 *   CELL = 12 (center-to-center), LOT_SIZE = 8, ROAD_W = 4
 *   Columns: x = −21, −9, +9, +21   (4 cols, spacing 12)
 *   Rows:    z = +21, +9, −9, −21   (4 rows, spacing 12)
 *
 * ─── Road centerlines ────────────────────────────────────────────
 *   N-S roads:  x = −27, −15, 0, +15, +27   (between/outside cols)
 *   E-W roads:  z = +27, +15,  0, −15, −27  (between/outside rows)
 *
 * ─── Verification ────────────────────────────────────────────────
 *   Lot x=−21 spans [−25, −17]. Lot x=−9 spans [−13, −5].
 *   Gap [−17, −13] → road center −15, width 4 ✓
 *   Outer road: center −27, spans [−29, −25] (meets lot edge −25) ✓
 *   Same math holds for all rows/cols.
 *
 * ─── City extents ────────────────────────────────────────────────
 *   Outer road edges reach ±29. CITY_HALF = 30 (walls at ±30).
 *   1-unit buffer between outer road edge and wall — enough for gates.
 *   Fountain plaza 8×8 at origin: edges at ±4.
 *   Inner park lot at x=±9: inner edge at ±5 → 1-unit gap from fountain ✓
 *
 * ─── Layout map (top view) ───────────────────────────────────────
 *   [B] [B] [B] [B]    ← row z=+21 (4 building lots)
 *   [B] [P] [P] [B]    ← row z=+9  (2 building + 2 park lots)
 *   [B] [P] [P] [B]    ← row z=-9  (2 building + 2 park lots)
 *   [B] [B] [B] [B]    ← row z=-21 (4 building lots)
 *   P = park lot (green, no building), fountain at (0,0) between them
 */

export const CELL      = 12
export const LOT_SIZE  = 8
export const ROAD_W    = 4    // CELL − LOT_SIZE
export const CITY_HALF = 30

// ── Road centerline positions ─────────────────────────────────────────────────
export const NS_ROADS  = [-27, -15, 0, 15, 27]   // N-S road x positions
export const EW_ROADS  = [27, 15, 0, -15, -27]   // E-W road z positions

// ── Lot grid ──────────────────────────────────────────────────────────────────
const COL_X = [-21, -9, 9, 21]
const ROW_Z = [21, 9, -9, -21]

// 4 permanent park lots — always green, never buildings
export const PARK_LOTS = [
  { x: -9, z:  9 }, { x:  9, z:  9 },
  { x: -9, z: -9 }, { x:  9, z: -9 },
]

// 12 building slots (outer ring: top row, bottom row, and outer 2 of middle rows)
export const FILE_SLOTS = [
  { x: -21, z:  21 }, { x: -9, z:  21 }, { x:  9, z:  21 }, { x:  21, z:  21 },
  { x: -21, z:   9 },                                          { x:  21, z:   9 },
  { x: -21, z:  -9 },                                          { x:  21, z:  -9 },
  { x: -21, z: -21 }, { x: -9, z: -21 }, { x:  9, z: -21 }, { x:  21, z: -21 },
]

// ── Wall + gate geometry (shared between CityBoundary and Gate) ───────────────
export const WALL_H      = 4.2   // perimeter wall height
export const GATE_OPEN_W = 4.0   // gate opening width
export const GATE_PILLAR = 1.0   // pillar width each side
export const GATE_SPAN   = GATE_OPEN_W + GATE_PILLAR * 2  // = 6.0 total per gate

// ── Dir gate row (back of city, embedded in the back wall at z=−30) ───────────
export const DIR_SLOTS = COL_X.map(x => ({ x, z: -CITY_HALF }))

// ── Entrance gate (embedded in the front wall at z=+CITY_HALF) ───────────────
export const ENTRANCE_POS = { x: 0, z: CITY_HALF }

// ── Layout function ───────────────────────────────────────────────────────────
export function cityLayout(children) {
  const files = children.filter(c => c.type === 'file')
  const dirs  = children.filter(c => c.type === 'dir')

  const filePool = files.length > FILE_SLOTS.length
    ? [...FILE_SLOTS, ...extraFileSlots(files.length - FILE_SLOTS.length)]
    : FILE_SLOTS

  const dirPool = dirs.length > DIR_SLOTS.length
    ? [...DIR_SLOTS, ...extraDirSlots(dirs.length - DIR_SLOTS.length)]
    : DIR_SLOTS

  return {
    fileSlots: filePool.map((pos, i) => ({ ...pos, node: files[i] ?? null })),
    dirSlots:  dirPool.map ((pos, i) => ({ ...pos, node: dirs[i]  ?? null })),
  }
}

function extraFileSlots(n) {
  const extra = []
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -3 : 3
    const row  = -Math.floor(i / 2)
    extra.push({ x: side * CELL, z: row * CELL })
  }
  return extra
}

function extraDirSlots(n) {
  const extra = []
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -(Math.floor(i / 2) + 3) : (Math.floor(i / 2) + 3)
    extra.push({ x: CELL * side, z: -CITY_HALF })
  }
  return extra
}
