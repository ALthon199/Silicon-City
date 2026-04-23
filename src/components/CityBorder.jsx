/**
 * CityBorder — modern precast-concrete perimeter wall.
 *
 * Design language: clean, minimalist. Each wall run is three horizontal layers:
 *   1. Footing  — dark concrete plinth at grade
 *   2. Panel    — smooth light-warm concrete slab (main wall face)
 *   3. Cap rail — thin dark steel coping strip on top
 *
 * Corner posts mark each of the four city corners and are slightly taller than
 * the wall panels so they read as deliberate punctuation marks.
 *
 * Wall depth (D) = 0.6 units.  Total wall height = 2.44 units.
 * Gate piers are PIER_H = 5.0 — walls intentionally read as low boundary, not
 * fortress; the gate arches are the dominant vertical element.
 *
 * Gap positions (all walls leave clear openings for every gate):
 *   Front edge (z = +30): gap x ∈ [−3, +3]  (entrance gate, FULL_W = 6)
 *   Back edge  (z = −30): gaps at x = −21, −9, +9, +21 each ±3
 *     → five wall segments between / around the four directory gates
 *   Side edges (x = ±30): no gates → continuous run z ∈ [−30, +30]
 *
 * Front/back walls end at x = ±29.5 (not ±30) so corner posts cap the joint
 * cleanly without Z-fighting the side walls.
 */
import * as THREE from 'three'

const noRay = () => null

// ── Materials ─────────────────────────────────────────────────────────────────
const matFooting  = new THREE.MeshLambertMaterial({ color: '#52504c' })
const matPanel    = new THREE.MeshLambertMaterial({ color: '#9c9890' })
const matCap      = new THREE.MeshLambertMaterial({ color: '#26262e' })
const matCorner   = new THREE.MeshLambertMaterial({ color: '#7c7870' })
const matCornerCap= new THREE.MeshLambertMaterial({ color: '#26262e' })

// ── Dimensions ────────────────────────────────────────────────────────────────
const D      = 0.60   // wall depth (front-to-back thickness)
const FH     = 0.30   // footing height
const PH     = 2.00   // main panel height
const CH     = 0.14   // cap rail height

const FY     = FH / 2                    // footing y-centre  = 0.15
const PY     = FH + PH / 2              // panel  y-centre  = 1.30
const CY     = FH + PH + CH / 2        // cap    y-centre  = 2.37

// Corner post dimensions
const CP_W   = 0.90   // corner post width & depth (square plan)
const CP_H   = PH + 0.20  // slightly taller than panel
const CP_PY  = FH + CP_H / 2
const CP_CY  = FH + CP_H + CH / 2

// ── Wall segment config ───────────────────────────────────────────────────────
// Each entry: { cx, cz, lx, lz }  — centre position and lengths.
// lx = length along X-axis (front/back walls), lz = length along Z-axis (sides).
// Exactly one of lx / lz is non-zero.
const WALL_SEGS = [
  // Front edge (z = +30): entrance gate gap at x ∈ [−3, +3]
  // Segments end at ±29.5 to leave room for corner post
  { cx: -16.25, cz:  30, lx: 26.5, lz: D   },
  { cx:  16.25, cz:  30, lx: 26.5, lz: D   },

  // Back edge (z = −30): four directory gate gaps
  { cx: -26.75, cz: -30, lx:  5.5, lz: D   },
  { cx:  -15.0, cz: -30, lx:  6.0, lz: D   },
  { cx:    0.0, cz: -30, lx: 12.0, lz: D   },
  { cx:   15.0, cz: -30, lx:  6.0, lz: D   },
  { cx:  26.75, cz: -30, lx:  5.5, lz: D   },

  // Side edges — full run, no interruptions
  { cx:  -30, cz: 0, lx: D, lz: 60 },
  { cx:   30, cz: 0, lx: D, lz: 60 },
]

// ── Corner post positions ─────────────────────────────────────────────────────
const CORNERS = [
  [-30,  30],
  [ 30,  30],
  [-30, -30],
  [ 30, -30],
]

// ── WallSection ───────────────────────────────────────────────────────────────
function WallSection({ cx, cz, lx, lz }) {
  return (
    <group position={[cx, 0, cz]}>
      {/* Footing */}
      <mesh position={[0, FY, 0]} receiveShadow material={matFooting} raycast={noRay}>
        <boxGeometry args={[lx, FH, lz]} />
      </mesh>
      {/* Main panel */}
      <mesh position={[0, PY, 0]} castShadow material={matPanel} raycast={noRay}>
        <boxGeometry args={[lx, PH, lz]} />
      </mesh>
      {/* Cap rail — slightly proud of panel face on each side */}
      <mesh position={[0, CY, 0]} castShadow material={matCap} raycast={noRay}>
        <boxGeometry args={[lx + 0.04, CH, lz + 0.04]} />
      </mesh>
    </group>
  )
}

// ── CornerPost ────────────────────────────────────────────────────────────────
function CornerPost({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      {/* Footing */}
      <mesh position={[0, FY, 0]} receiveShadow material={matFooting} raycast={noRay}>
        <boxGeometry args={[CP_W, FH, CP_W]} />
      </mesh>
      {/* Post body */}
      <mesh position={[0, CP_PY, 0]} castShadow material={matCorner} raycast={noRay}>
        <boxGeometry args={[CP_W, CP_H, CP_W]} />
      </mesh>
      {/* Cap */}
      <mesh position={[0, CP_CY, 0]} castShadow material={matCornerCap} raycast={noRay}>
        <boxGeometry args={[CP_W + 0.06, CH, CP_W + 0.06]} />
      </mesh>
    </group>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CityBorder() {
  return (
    <group>
      {WALL_SEGS.map((seg, i) => (
        <WallSection key={i} {...seg} />
      ))}
      {CORNERS.map(([x, z], i) => (
        <CornerPost key={i} x={x} z={z} />
      ))}
    </group>
  )
}
