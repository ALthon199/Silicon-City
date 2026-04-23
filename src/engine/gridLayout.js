/**
 * City Layout Engine — doubled city (8×8 block grid)
 *
 * Design: each file slot is a raised 8×8 concrete slab (the "lot").
 * Roads are the gaps between slabs — filled by a single asphalt base mesh.
 *
 * ─── Lot grid ────────────────────────────────────────────────────
 *   CELL = 12 (center-to-center), LOT_SIZE = 8, ROAD_W = 4
 *   Columns: x = −45,−33,−21,−9, +9,+21,+33,+45   (8 cols, spacing 12)
 *   Rows:    z = +45,+33,+21,+9, −9,−21,−33,−45   (8 rows, spacing 12)
 *   Centre gap (between −9 and +9) = 18 (1.5×CELL) — fountain plaza
 *
 * ─── Road centerlines ────────────────────────────────────────────
 *   N-S roads:  x = −51,−39,−27,−15, 0,+15,+27,+39,+51
 *   E-W roads:  z = +51,+39,+27,+15, 0,−15,−27,−39,−51
 *
 * ─── Verification ────────────────────────────────────────────────
 *   Outer lot x=−45 spans [−49, −41]. Road at x=−51 spans [−53,−49] ✓
 *   Wall at x=−54: 1-unit gap from road edge −53 ✓
 *   Same math holds for all rows/cols.
 *
 * ─── City extents ────────────────────────────────────────────────
 *   CITY_HALF = 54 (walls at ±54)
 *   60 building slots (8×8 grid minus 4 central park lots)
 *   8 directory gates on the back wall (z = −54)
 *   1 entrance gate on the front wall (z = +54, x = 0)
 */

export const CELL      = 12
export const LOT_SIZE  = 8
export const ROAD_W    = 4    // CELL − LOT_SIZE
export const CITY_HALF = 54

// ── Road centerline positions ─────────────────────────────────────────────────
export const NS_ROADS  = [-51, -39, -27, -15, 0, 15, 27, 39, 51]
export const EW_ROADS  = [ 51,  39,  27,  15, 0,-15,-27,-39,-51]

// ── Lot grid ──────────────────────────────────────────────────────────────────
const COL_X = [-45, -33, -21, -9,  9, 21, 33, 45]
const ROW_Z = [ 45,  33,  21,  9, -9,-21,-33,-45]

// 4 permanent park lots — always green, never buildings
export const PARK_LOTS = [
  { x: -9, z:  9 }, { x:  9, z:  9 },
  { x: -9, z: -9 }, { x:  9, z: -9 },
]

const PARK_SET = new Set(PARK_LOTS.map(({ x, z }) => `${x},${z}`))

// 60 building slots (all 8×8 positions except the 4 central park lots)
export const FILE_SLOTS = []
for (const x of COL_X) {
  for (const z of ROW_Z) {
    if (!PARK_SET.has(`${x},${z}`)) FILE_SLOTS.push({ x, z })
  }
}

// ── Wall + gate geometry (shared between CityBoundary and Gate) ───────────────
export const WALL_H      = 4.2
export const GATE_OPEN_W = 4.0
export const GATE_PILLAR = 1.0
export const GATE_SPAN   = GATE_OPEN_W + GATE_PILLAR * 2  // = 6.0

// ── Dir gate row (back wall at z = −CITY_HALF) — 8 gates ─────────────────────
export const DIR_SLOTS = COL_X.map(x => ({ x, z: -CITY_HALF }))

// ── Entrance gate (front wall at z = +CITY_HALF) ──────────────────────────────
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
    const side = i % 2 === 0 ? -(Math.floor(i / 2) + 5) : (Math.floor(i / 2) + 5)
    extra.push({ x: CELL * side, z: -CITY_HALF })
  }
  return extra
}
