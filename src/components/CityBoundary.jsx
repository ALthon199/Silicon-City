/**
 * CityBoundary — city infrastructure and ground decoration.
 *
 * No perimeter walls: the city fades into the grass ground plane.
 *
 * Road markings, sidewalks and boulevard trees are all rendered via
 * InstancedMesh so the entire road package costs ≤ 7 draw calls.
 *
 * Y stacking order (no z-fighting):
 *   asphalt base top   = 0.16
 *   road dashes        = 0.17
 *   crosswalk stripes  = 0.18
 *   sidewalk strips    = 0.20
 *   lot slab top       = 0.36   (PlotGrid / park grass)
 *
 * Grid layout (top view):
 *   [B] [B] [B] [B]   ← z=+21
 *   [B] [P] [P] [B]   ← z=+9   P = park lot
 *   [B] [P] [P] [B]   ← z=-9
 *   [B] [B] [B] [B]   ← z=-21
 *   Grand fountain at (0,0) between park lots.
 *
 *   N-S road centres: x = -27, -15, 0, +15, +27
 *   E-W road centres: z = +27, +15,  0, -15, -27
 */
import { useRef, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  PARK_LOTS, FILE_SLOTS,
  LOT_SIZE, GATE_OPEN_W,
  NS_ROADS, EW_ROADS,
} from '../engine/gridLayout'

const _dummy = new THREE.Object3D()
const TAU    = Math.PI * 2
const noRay  = () => null

// ── Slab dimensions (must match PlotGrid.jsx) ─────────────────────────────────
const SLAB_Y   = 0.22
const SLAB_H   = 0.28
const SLAB_TOP = SLAB_Y + SLAB_H / 2   // 0.36

// ── Shared materials ──────────────────────────────────────────────────────────
const mat = {
  asphalt:   new THREE.MeshLambertMaterial({ color: '#383830' }),
  // Parks & greenery
  grass:     new THREE.MeshLambertMaterial({ color: '#3a8c20' }),
  grassDk:   new THREE.MeshLambertMaterial({ color: '#286014' }),
  hedge:     new THREE.MeshLambertMaterial({ color: '#2a6e12' }),
  curbPark:  new THREE.MeshLambertMaterial({ color: '#4a7830' }),
  leaf:      new THREE.MeshLambertMaterial({ color: '#2d7a1f' }),
  leaf2:     new THREE.MeshLambertMaterial({ color: '#3a9427' }),
  // Park furniture
  bench:     new THREE.MeshLambertMaterial({ color: '#8b6914' }),
  benchLeg:  new THREE.MeshLambertMaterial({ color: '#444444' }),
  flowerR:   new THREE.MeshLambertMaterial({ color: '#e83030' }),
  flowerY:   new THREE.MeshLambertMaterial({ color: '#f0c820' }),
  flowerP:   new THREE.MeshLambertMaterial({ color: '#c040c8' }),
  flowerW:   new THREE.MeshLambertMaterial({ color: '#f0f0e8' }),
  // Plazas & fountain
  plaza:     new THREE.MeshLambertMaterial({ color: '#ccc4b0' }),
  plazaAcc:  new THREE.MeshLambertMaterial({ color: '#e8dfc8' }),
  plazaDark: new THREE.MeshLambertMaterial({ color: '#a89880' }),
  waterGlow: new THREE.MeshLambertMaterial({ color: '#50c4f8', emissive: new THREE.Color('#0088cc').multiplyScalar(0.55), transparent: true, opacity: 0.90 }),
  droplet:   new THREE.MeshBasicMaterial({ color: '#88ddff', transparent: true, opacity: 0.82 }),
  // Plaza planters
  planter:   new THREE.MeshLambertMaterial({ color: '#a89880' }),
  // Road markings
  roadMark:  new THREE.MeshBasicMaterial({ color: '#f4f0e0' }),  // off-white dashes
  sidewalk:  new THREE.MeshLambertMaterial({ color: '#b8b0a0' }), // concrete
  xwalk:     new THREE.MeshBasicMaterial({ color: '#e8e4d4' }),   // crosswalk stripe
}

// ── Generic box helper ────────────────────────────────────────────────────────
function Box({ pos, size, m, shadow }) {
  return (
    <mesh position={pos} material={m} castShadow={!!shadow} receiveShadow={!!shadow} raycast={noRay}>
      <boxGeometry args={size} />
    </mesh>
  )
}

// ── Road centre dashes (InstancedMesh) ───────────────────────────────────────
// 230 dashes total: 23 dashes × 5 N-S roads + 23 dashes × 5 E-W roads.
// Geometry is [0.15, 0.04, 1.0] (elongated along Z); E-W dashes rotate 90° around Y.
// Placed at y=0.17 — just above asphalt top (0.16), no z-fight.
const DASH_GEO = new THREE.BoxGeometry(0.15, 0.04, 1.0)
const DASH_STEP  = 2.4   // period = dash (1.0) + gap (1.4)
const DASH_START = -26.7 // first dash centre along the road axis
const DASH_END   = 26.8  // stop before this value

function RoadMarkings() {
  const ref = useRef()

  useLayoutEffect(() => {
    let idx = 0
    const mesh = ref.current
    if (!mesh) return

    // N-S roads — dashes run along Z
    for (const rx of NS_ROADS) {
      for (let z = DASH_START; z <= DASH_END; z += DASH_STEP) {
        _dummy.position.set(rx, 0.17, z)
        _dummy.rotation.set(0, 0, 0)
        _dummy.scale.setScalar(1)
        _dummy.updateMatrix()
        mesh.setMatrixAt(idx++, _dummy.matrix)
      }
    }
    // E-W roads — same geometry rotated 90° → dash runs along X
    for (const rz of EW_ROADS) {
      for (let x = DASH_START; x <= DASH_END; x += DASH_STEP) {
        _dummy.position.set(x, 0.17, rz)
        _dummy.rotation.set(0, Math.PI / 2, 0)
        _dummy.scale.setScalar(1)
        _dummy.updateMatrix()
        mesh.setMatrixAt(idx++, _dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = idx
  }, [])

  return (
    <instancedMesh ref={ref} args={[DASH_GEO, mat.roadMark, 260]} raycast={noRay} />
  )
}

// ── Sidewalk strips (InstancedMesh) ───────────────────────────────────────────
// One strip per edge of every lot (16 lots × 4 edges = 64 strips).
// Geometry: [LOT_SIZE, 0.07, 0.5] elongated along X.
// N/S edges: no rotation. E/W edges: rotate 90° around Y.
// Placed at y=0.20 (above dashes at 0.17, below lot slab at 0.36).
// Offset from lot centre = LOT_SIZE/2 + 0.25 = 4.25 units.
const SW_OFFSET = LOT_SIZE / 2 + 0.25   // = 4.25
const SW_GEO    = new THREE.BoxGeometry(LOT_SIZE, 0.07, 0.5)

// All lots that need sidewalks
const ALL_LOTS = [...FILE_SLOTS, ...PARK_LOTS]

function Sidewalks() {
  const ref = useRef()

  useLayoutEffect(() => {
    let idx = 0
    const mesh = ref.current
    if (!mesh) return

    for (const { x, z } of ALL_LOTS) {
      // North edge
      _dummy.position.set(x, 0.20, z + SW_OFFSET)
      _dummy.rotation.set(0, 0, 0); _dummy.scale.setScalar(1); _dummy.updateMatrix()
      mesh.setMatrixAt(idx++, _dummy.matrix)
      // South edge
      _dummy.position.set(x, 0.20, z - SW_OFFSET)
      _dummy.updateMatrix()
      mesh.setMatrixAt(idx++, _dummy.matrix)
      // East edge (rotate 90° so strip runs N-S along lot edge)
      _dummy.position.set(x + SW_OFFSET, 0.20, z)
      _dummy.rotation.set(0, Math.PI / 2, 0); _dummy.updateMatrix()
      mesh.setMatrixAt(idx++, _dummy.matrix)
      // West edge
      _dummy.position.set(x - SW_OFFSET, 0.20, z)
      _dummy.updateMatrix()
      mesh.setMatrixAt(idx++, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = idx
  }, [])

  return (
    <instancedMesh ref={ref} args={[SW_GEO, mat.sidewalk, 70]} raycast={noRay} />
  )
}

// ── Crosswalk stripes at directory gates (InstancedMesh) ──────────────────────
// 4 dir gates at z=-30, x ∈ {-21,-9,+9,+21}.
// Pedestrians cross the outer E-W road (centre z=-27, spans z=-25 to z=-29).
// 5 stripes per gate, stepping south from z=-26.0 to z=-28.0 in 0.5 increments.
// Stripe: [GATE_OPEN_W, 0.04, 0.2] at y=0.18 (above dashes, below sidewalks).
const XW_GEO     = new THREE.BoxGeometry(GATE_OPEN_W, 0.04, 0.20)
const XW_Z_START = -26.0
const XW_GATE_XS = [-21, -9, 9, 21]

function CrosswalkStripes() {
  const ref = useRef()

  useLayoutEffect(() => {
    let idx = 0
    const mesh = ref.current
    if (!mesh) return

    for (const gx of XW_GATE_XS) {
      for (let i = 0; i < 5; i++) {
        _dummy.position.set(gx, 0.18, XW_Z_START - i * 0.5)
        _dummy.rotation.set(0, 0, 0); _dummy.scale.setScalar(1); _dummy.updateMatrix()
        mesh.setMatrixAt(idx++, _dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.count = idx
  }, [])

  return (
    <instancedMesh ref={ref} args={[XW_GEO, mat.xwalk, 25]} raycast={noRay} />
  )
}


// ── Park bench ────────────────────────────────────────────────────────────────
function Bench({ x, z, ry = 0 }) {
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <Box pos={[0, 0.48, 0]}    size={[1.5, 0.10, 0.50]} m={mat.bench} />
      <Box pos={[0, 0.65, -0.2]} size={[1.5, 0.40, 0.08]} m={mat.bench} />
      <Box pos={[-0.6, 0.24, 0]} size={[0.1, 0.48, 0.45]} m={mat.benchLeg} />
      <Box pos={[ 0.6, 0.24, 0]} size={[0.1, 0.48, 0.45]} m={mat.benchLeg} />
    </group>
  )
}

// ── Flower bed ────────────────────────────────────────────────────────────────
function Flower({ x, z, color }) {
  const fm = { R: mat.flowerR, Y: mat.flowerY, P: mat.flowerP, W: mat.flowerW }[color] ?? mat.flowerY
  return (
    <group position={[x, 0, z]}>
      <Box pos={[0, 0.14, 0]} size={[2.0, 0.28, 1.0]} m={mat.grass} />
      <Box pos={[0, 0.34, 0]} size={[1.5, 0.18, 0.7]} m={fm} />
    </group>
  )
}

// ── Hedge / trimmed shrub ─────────────────────────────────────────────────────
function Hedge({ x, z, w, d }) {
  return (
    <group position={[x, SLAB_TOP, z]}>
      <Box pos={[0, 0.20, 0]} size={[w, 0.40, d]}              m={mat.hedge} />
      <Box pos={[0, 0.55, 0]} size={[w * 0.85, 0.30, d * 0.85]} m={mat.leaf} />
    </group>
  )
}

// ── Park lot (permanent green space) ─────────────────────────────────────────
function ParkLot({ x, z, variant = 0 }) {
  const benchRy = Math.atan2(x, z)   // bench faces city centre
  return (
    <group position={[x, 0, z]}>
      {/* Green slab */}
      <mesh position={[0, SLAB_Y, 0]} receiveShadow raycast={noRay}>
        <boxGeometry args={[8, SLAB_H, 8]} />
        <primitive object={mat.grass} attach="material" />
      </mesh>
      {/* Curb strips */}
      {[[0, -3.75, 1], [0, 3.75, 1], [-3.75, 0, 0], [3.75, 0, 0]].map(([cx, cz, axis], i) => (
        <mesh key={i} position={[cx, SLAB_TOP + 0.05, cz]} raycast={noRay}>
          <boxGeometry args={axis ? [8, 0.10, 0.5] : [0.5, 0.10, 8]} />
          <primitive object={mat.curbPark} attach="material" />
        </mesh>
      ))}
      {/* Central hedge */}
      <Hedge x={0} z={0} w={2.2} d={2.2} />
      {/* Bench + flowers on slab surface */}
      <group position={[0, SLAB_TOP, 0]}>
        <Flower
          x={variant < 2 ? 2.2 : -2.2}
          z={variant % 2 === 0 ? 2.2 : -2.2}
          color={['R', 'Y', 'W', 'P'][variant]}
        />
        <Flower
          x={variant < 2 ? -2.2 : 2.2}
          z={variant % 2 === 0 ? -2.2 : 2.2}
          color={['Y', 'P', 'R', 'W'][variant]}
        />
        <Bench x={0} z={0} ry={benchRy} />
      </group>
    </group>
  )
}

// ── Grand central fountain ────────────────────────────────────────────────────
//
// Water jet definitions.  Each jet follows a parabolic arc:
//   y(phase) = yStart + (yEnd−yStart)*phase + arcH * 4*phase*(1−phase)
// The 'rise' type jets shoot straight up and fall back (center crown spout).
//
// Basin radii used:
//   Top basin rim    r ≈ 0.40  (square 0.80 → inscribed circle)
//   Mid basin rim    r ≈ 0.94  (square 1.88 → inscribed circle)
//   Outer basin rim  r ≈ 1.90  (outer water surface r~2.0, land a bit inside)
//   Outer basin drop r ≈ 2.15  (spray lands just past rim → realistic splash)
//
const WATER_JETS = [
  // ── Tier-1: 8 jets, top basin rim → mid basin surface ────────────────────
  ...Array.from({ length: 8 }, (_, i) => ({
    angle:  i * Math.PI / 4,
    rStart: 0.40, yStart: 3.92,
    rEnd:   0.78, yEnd:   2.72,
    period: 1.35, phase0: i / 8, arcH: 0.55,
  })),
  // ── Tier-2: 6 jets, mid basin rim → outer basin surface ──────────────────
  ...Array.from({ length: 6 }, (_, i) => ({
    angle:  i * Math.PI / 3,
    rStart: 0.94, yStart: 2.72,
    rEnd:   1.90, yEnd:   1.34,
    period: 1.70, phase0: i / 6, arcH: 0.78,
  })),
  // ── Tier-3: 6 short spray jets from outer basin rim ──────────────────────
  ...Array.from({ length: 6 }, (_, i) => ({
    angle:  i * Math.PI / 3 + Math.PI / 6,   // 30° offset from tier-2
    rStart: 1.88, yStart: 1.34,
    rEnd:   2.18, yEnd:   0.96,
    period: 1.90, phase0: i / 6, arcH: 0.40,
  })),
  // ── Crown: 5 rising jets from central spire tip ───────────────────────────
  ...Array.from({ length: 5 }, (_, i) => ({
    angle:  i * Math.PI * 2 / 5,
    rStart: 0.06, yStart: 5.96,
    rEnd:   0.06, yEnd:   5.96,   // same XZ — rises and falls vertically
    period: 1.10, phase0: i / 5, arcH: 0, yPeak: 7.15,
  })),
]

const WATER_COUNT = WATER_JETS.length          // = 25
const WATER_GEO   = new THREE.SphereGeometry(0.35, 6, 6)

function CentralFountain() {
  const crownRef = useRef()
  const waterRef = useRef()

  useFrame((_, delta) => {
    const t = performance.now() / 1000
    if (crownRef.current) crownRef.current.rotation.y += delta * 0.22

    if (waterRef.current) {
      for (let i = 0; i < WATER_COUNT; i++) {
        const jet = WATER_JETS[i]
        const phase = ((t / jet.period + jet.phase0) % 1)

        const rr = jet.rStart + (jet.rEnd - jet.rStart) * phase

        let yy
        if (jet.yPeak !== undefined) {
          // Crown: pure vertical sine arc
          yy = jet.yStart + (jet.yPeak - jet.yStart) * Math.sin(phase * Math.PI)
        } else {
          // Normal parabolic arc
          yy = jet.yStart + (jet.yEnd - jet.yStart) * phase
               + jet.arcH * 4 * phase * (1 - phase)
        }

        const sc = jet.yPeak !== undefined
          ? 0.30 + 0.70 * Math.sin(phase * Math.PI)   // grow→shrink symmetrically
          : 0.40 + 0.60 * (1 - phase)                 // big at start, tiny on splash

        _dummy.position.set(Math.cos(jet.angle) * rr, yy, Math.sin(jet.angle) * rr)
        _dummy.scale.setScalar(sc)
        _dummy.updateMatrix()
        waterRef.current.setMatrixAt(i, _dummy.matrix)
      }
      waterRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Grand plaza base */}
      <Box pos={[0, 0.28, 0]} size={[8.0, 0.24, 8.0]} m={mat.plaza} shadow />
      <Box pos={[0, 0.42, 0]} size={[7.2, 0.04, 7.2]} m={mat.plazaAcc} />
      {[[-3.2,-3.2],[3.2,-3.2],[-3.2,3.2],[3.2,3.2]].map(([px,pz]) => (
        <Box key={`c${px}${pz}`} pos={[px, 0.44, pz]} size={[0.55, 0.06, 0.55]} m={mat.plazaDark} />
      ))}
      <Box pos={[0, 0.43, 0]} size={[5.4, 0.03, 5.4]} m={mat.plazaDark} />

      {/* Outer basin */}
      <Box pos={[0, 0.90, 0]} size={[5.0, 1.0, 5.0]} m={mat.plaza} shadow />
      <Box pos={[0, 1.29, 0]} size={[4.35, 0.06, 4.35]} m={mat.waterGlow} />
      {[0,1,2,3,4,5,6,7].map(i => {
        const a = (i * Math.PI) / 4
        const r = 1.75
        return (
          <mesh key={i} position={[Math.sin(a)*r, 1.18, Math.cos(a)*r]}
            rotation={[-Math.cos(a)*0.42, 0, Math.sin(a)*0.42]}
            material={mat.waterGlow} raycast={noRay}>
            <boxGeometry args={[0.09, 0.95, 0.09]} />
          </mesh>
        )
      })}

      {/* Mid pedestal */}
      <Box pos={[0, 1.70, 0]} size={[2.8, 0.60, 2.8]} m={mat.plazaDark} shadow />
      {/* Mid basin */}
      <Box pos={[0, 2.40, 0]} size={[2.2, 0.80, 2.2]} m={mat.plaza} shadow />
      <Box pos={[0, 2.69, 0]} size={[1.88, 0.06, 1.88]} m={mat.waterGlow} />
      {[0,1,2,3].map(i => {
        const a = (i * Math.PI) / 2
        const r = 0.78
        return (
          <mesh key={i} position={[Math.sin(a)*r, 2.34, Math.cos(a)*r]}
            rotation={[-Math.cos(a)*0.50, 0, Math.sin(a)*0.50]}
            material={mat.waterGlow} raycast={noRay}>
            <boxGeometry args={[0.08, 0.72, 0.08]} />
          </mesh>
        )
      })}

      {/* Upper pedestal */}
      <Box pos={[0, 3.10, 0]} size={[1.4, 0.60, 1.4]} m={mat.plazaDark} shadow />
      {/* Top basin */}
      <Box pos={[0, 3.65, 0]} size={[1.00, 0.50, 1.00]} m={mat.plaza} shadow />
      <Box pos={[0, 3.88, 0]} size={[0.80, 0.05, 0.80]} m={mat.waterGlow} />

      {/* Central spire */}
      <Box pos={[0, 4.70, 0]} size={[0.32, 1.60, 0.32]} m={mat.plazaDark} shadow />
      <Box pos={[0, 5.58, 0]} size={[0.22, 0.22, 0.22]} m={mat.waterGlow} />

      {/* Rotating crown */}
      <group ref={crownRef} position={[0, 5.74, 0]}>
        <Box pos={[0, 0.00, 0]} size={[0.92, 0.16, 0.92]} m={mat.plaza} />
        <Box pos={[0, 0.24, 0]} size={[0.58, 0.48, 0.58]} m={mat.waterGlow} />
        <Box pos={[ 0.58, 0.06, 0]} size={[0.38, 0.10, 0.10]} m={mat.plazaAcc} />
        <Box pos={[-0.58, 0.06, 0]} size={[0.38, 0.10, 0.10]} m={mat.plazaAcc} />
        <Box pos={[0, 0.06,  0.58]} size={[0.10, 0.10, 0.38]} m={mat.plazaAcc} />
        <Box pos={[0, 0.06, -0.58]} size={[0.10, 0.10, 0.38]} m={mat.plazaAcc} />
      </group>

      {/* Animated water jets (parabolic arcs across all three basin tiers + crown spout) */}
      <instancedMesh ref={waterRef} args={[WATER_GEO, mat.droplet, WATER_COUNT]} raycast={noRay} />
    </group>
  )
}


// ── Entrance approach plaza ───────────────────────────────────────────────────
function EntranceApproach() {
  return (
    <group position={[0, 0, 27.5]}>
      <Box pos={[0, 0.22, 0]} size={[5.8, 0.12, 3.0]} m={mat.plaza} />
      <Box pos={[0, 0.30, 0]} size={[4.0, 0.06, 2.0]} m={mat.plazaAcc} />
    </group>
  )
}

// ── Plaza planter ─────────────────────────────────────────────────────────────
function PlazaPlanter({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Box pos={[0, 0.26, 0]} size={[0.88, 0.52, 0.88]} m={mat.planter} />
      <Box pos={[0, 0.54, 0]} size={[0.68, 0.08, 0.68]} m={mat.plaza} />
      <Box pos={[0, 0.64, 0]} size={[0.52, 0.20, 0.52]} m={mat.grassDk} />
      <Box pos={[0, 0.80, 0]} size={[0.28, 0.24, 0.28]} m={mat.leaf2} />
    </group>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CityBoundary() {
  return (
    <group>
      {/* ── Asphalt base (60×60, covers entire city floor) ── */}
      <mesh position={[0, 0.08, 0]} receiveShadow raycast={noRay}>
        <boxGeometry args={[60, 0.16, 60]} />
        <primitive object={mat.asphalt} attach="material" />
      </mesh>

      {/* ── Road centre dashes ── */}
      <RoadMarkings />

      {/* ── Sidewalk strips around every lot ── */}
      <Sidewalks />

      {/* ── Crosswalk stripes at directory gates ── */}
      <CrosswalkStripes />

      {/* ── 4 Park lots ── */}
      {PARK_LOTS.map(({ x, z }, i) => (
        <ParkLot key={i} x={x} z={z} variant={i} />
      ))}

      {/* ── Grand central fountain ── */}
      <CentralFountain />

      {/* ── Entrance approach plaza ── */}
      <EntranceApproach />

      {/* ── Plaza planters flanking fountain (E-W axis) ── */}
      <PlazaPlanter x={ 4.5} z={0} />
      <PlazaPlanter x={-4.5} z={0} />
      <PlazaPlanter x={0} z={ 4.5} />
      <PlazaPlanter x={0} z={-4.5} />
    </group>
  )
}
