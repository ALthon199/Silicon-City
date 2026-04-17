/**
 * CityBoundary — city infrastructure and decoration.
 *
 * Single asphalt base (60×60) covers the city interior.
 * Building lot slabs sit on top (rendered by PlotGrid).
 * A grand fountain plaza (8×8) dominates the center.
 * 4 park lots at (±9, ±9) surround the fountain with green space.
 * Mini roundabouts at the 4 inner intersections (±15, ±15).
 * Corner grass patches fill the buffer zone near the perimeter walls.
 *
 * Grid layout (top view):
 *   [B] [B] [B] [B]   ← z=+21
 *   [B] [P] [P] [B]   ← z=+9   P = park lot
 *   [B] [P] [P] [B]   ← z=−9
 *   [B] [B] [B] [B]   ← z=−21
 *   Grand fountain at (0,0) between the 4 park lots.
 *
 * Back wall gate positions: x = −21, −9, +9, +21
 * Segments between gates: centers −27, −15, 0, +15, +27
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CITY_HALF, WALL_H, PARK_LOTS } from '../engine/gridLayout'

const _dummy = new THREE.Object3D()
const TAU    = Math.PI * 2

const H      = CITY_HALF  // 30
const noRay  = () => null

// Lot slab dimensions — must match PlotGrid.jsx
const SLAB_Y   = 0.22           // center Y of lot slab
const SLAB_H   = 0.28           // height of lot slab
const SLAB_TOP = SLAB_Y + SLAB_H / 2   // = 0.36  (top surface of slab)

// ─── Shared materials ─────────────────────────────────────────────────────────
const mat = {
  asphalt:   new THREE.MeshLambertMaterial({ color: '#404038' }),
  stone:     new THREE.MeshLambertMaterial({ color: '#b8aca0' }),
  tower:     new THREE.MeshLambertMaterial({ color: '#9a8880' }),
  merlon:    new THREE.MeshLambertMaterial({ color: '#c8b8a8' }),
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
  // Street furniture
  lampPost:  new THREE.MeshLambertMaterial({ color: '#1e1e2a' }),
  lamp:      new THREE.MeshBasicMaterial({ color: '#fff8c0' }),
  trunk:     new THREE.MeshLambertMaterial({ color: '#8b6914' }),
  planter:   new THREE.MeshLambertMaterial({ color: '#a89880' }),
}

// ─── Generic box helper ───────────────────────────────────────────────────────
function Box({ pos, size, m, shadow }) {
  return (
    <mesh position={pos} material={m} castShadow={!!shadow} receiveShadow={!!shadow} raycast={noRay}>
      <boxGeometry args={size} />
    </mesh>
  )
}

// ─── Perimeter wall with battlements ─────────────────────────────────────────
function WallSection({ pos, size }) {
  const [w, wh, d] = size
  const isEW = w > d
  const span = isEW ? w : d
  const n    = Math.round(span / 2.4)
  const step = span / n
  return (
    <group position={pos}>
      <Box pos={[0, 0, 0]} size={size} m={mat.stone} shadow />
      {Array.from({ length: n }).map((_, i) => {
        if (i % 2 !== 0) return null
        const off = -span / 2 + step * (i + 0.5)
        return (
          <Box
            key={i}
            pos={isEW ? [off, wh / 2 + 0.4, 0] : [0, wh / 2 + 0.4, off]}
            size={isEW ? [step * 0.7, 0.8, d + 0.1] : [w + 0.1, 0.8, step * 0.7]}
            m={mat.merlon}
          />
        )
      })}
    </group>
  )
}

// ─── Corner tower ─────────────────────────────────────────────────────────────
function CornerTower({ x, z }) {
  const th = 8.0
  return (
    <group position={[x, 0, z]}>
      <Box pos={[0, th / 2, 0]}    size={[3.2, th, 3.2]}    m={mat.tower} shadow />
      <Box pos={[0, th + 0.35, 0]} size={[3.6, 0.7, 3.6]}   m={mat.merlon} />
      <Box pos={[0, th + 1.9, 0]}  size={[0.14, 2.6, 0.14]} m={mat.tower} />
    </group>
  )
}

// ─── Park bench ───────────────────────────────────────────────────────────────
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

// ─── Flower bed ───────────────────────────────────────────────────────────────
function Flower({ x, z, color }) {
  const fm = { R: mat.flowerR, Y: mat.flowerY, P: mat.flowerP, W: mat.flowerW }[color] ?? mat.flowerY
  return (
    <group position={[x, 0, z]}>
      <Box pos={[0, 0.14, 0]} size={[2.0, 0.28, 1.0]} m={mat.grass} />
      <Box pos={[0, 0.34, 0]} size={[1.5, 0.18, 0.7]} m={fm} />
    </group>
  )
}

// ─── Hedge / trimmed shrub ────────────────────────────────────────────────────
// Positions itself at SLAB_TOP so callers don't need to offset.
function Hedge({ x, z, w, d }) {
  return (
    <group position={[x, SLAB_TOP, z]}>
      <Box pos={[0, 0.20, 0]} size={[w, 0.40, d]}              m={mat.hedge} />
      <Box pos={[0, 0.55, 0]} size={[w * 0.85, 0.30, d * 0.85]} m={mat.leaf} />
    </group>
  )
}

// ─── Park lot (permanent green space) ────────────────────────────────────────
// 8×8 green slab at the same height as building slabs.
// variant: 0=NW(-9,+9), 1=NE(+9,+9), 2=SW(-9,-9), 3=SE(+9,-9)
function ParkLot({ x, z, variant = 0 }) {
  const benchRy = Math.atan2(x, z)   // face toward city center

  return (
    <group position={[x, 0, z]}>
      {/* Green slab — same Y/H as building lot slabs */}
      <mesh position={[0, SLAB_Y, 0]} receiveShadow raycast={noRay}>
        <boxGeometry args={[8, SLAB_H, 8]} />
        <primitive object={mat.grass} attach="material" />
      </mesh>

      {/* Curb strips on all four edges */}
      <mesh position={[0,  SLAB_TOP + 0.05, -3.75]} raycast={noRay}>
        <boxGeometry args={[8, 0.10, 0.5]} />
        <primitive object={mat.curbPark} attach="material" />
      </mesh>
      <mesh position={[0,  SLAB_TOP + 0.05,  3.75]} raycast={noRay}>
        <boxGeometry args={[8, 0.10, 0.5]} />
        <primitive object={mat.curbPark} attach="material" />
      </mesh>
      <mesh position={[-3.75, SLAB_TOP + 0.05, 0]} raycast={noRay}>
        <boxGeometry args={[0.5, 0.10, 8]} />
        <primitive object={mat.curbPark} attach="material" />
      </mesh>
      <mesh position={[ 3.75, SLAB_TOP + 0.05, 0]} raycast={noRay}>
        <boxGeometry args={[0.5, 0.10, 8]} />
        <primitive object={mat.curbPark} attach="material" />
      </mesh>

      {/* Central hedge — Hedge offsets itself to SLAB_TOP internally */}
      <Hedge x={0} z={0} w={2.2} d={2.2} />

      {/* Bench + flowers lifted to slab top surface */}
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

// ─── Grand central fountain ────────────────────────────────────────────────────
// 8×8 grand plaza base sits at city center (0, 0).
// Park lot inner edges are at ±5, fountain plaza edges at ±4 — 1-unit gap, no overlap.
// Three-basin tower rises ~5.7 units. Crown rotates; water surfaces glow blue.
const NDROP  = 6
const DROP_R = 0.72   // orbit radius around spire
const DROP_Y = 4.60   // base orbit height above fountain floor

function CentralFountain() {
  const crownRef = useRef()
  const dropsRef = useRef()

  useFrame((_, delta) => {
    const t = performance.now() / 1000

    if (crownRef.current) crownRef.current.rotation.y += delta * 0.22

    // Orbit 6 glowing water droplets around the spire
    if (dropsRef.current) {
      for (let i = 0; i < NDROP; i++) {
        const angle = t * 1.1 + (i * TAU) / NDROP
        const bobY  = Math.sin(t * 2.8 + (i * TAU) / NDROP) * 0.28
        _dummy.position.set(Math.cos(angle) * DROP_R, DROP_Y + bobY, Math.sin(angle) * DROP_R)
        _dummy.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(t * 1.5 + i)))
        _dummy.updateMatrix()
        dropsRef.current.setMatrixAt(i, _dummy.matrix)
      }
      dropsRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {/* ── Grand plaza base ──
           bottom=0.16 (asphalt top), height=0.24, center=0.28, top=0.40 ── */}
      <Box pos={[0, 0.28, 0]} size={[8.0, 0.24, 8.0]} m={mat.plaza} shadow />
      <Box pos={[0, 0.42, 0]} size={[7.2, 0.04, 7.2]} m={mat.plazaAcc} />
      {[[-3.2,-3.2],[3.2,-3.2],[-3.2,3.2],[3.2,3.2]].map(([px,pz]) => (
        <Box key={`c${px}${pz}`} pos={[px, 0.44, pz]} size={[0.55, 0.06, 0.55]} m={mat.plazaDark} />
      ))}
      <Box pos={[0, 0.43, 0]} size={[5.4, 0.03, 5.4]} m={mat.plazaDark} />

      {/* ── Outer basin — bottom=0.40 → center=0.90 → top=1.40 ── */}
      <Box pos={[0, 0.90, 0]} size={[5.0, 1.0, 5.0]} m={mat.stone} shadow />
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

      {/* ── Mid pedestal — bottom=1.40 → center=1.70 → top=2.00 ── */}
      <Box pos={[0, 1.70, 0]} size={[2.8, 0.60, 2.8]} m={mat.plazaDark} shadow />

      {/* ── Mid basin — bottom=2.00 → center=2.40 → top=2.80 ── */}
      <Box pos={[0, 2.40, 0]} size={[2.2, 0.80, 2.2]} m={mat.stone} shadow />
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

      {/* ── Upper pedestal — bottom=2.80 → center=3.10 → top=3.40 ── */}
      <Box pos={[0, 3.10, 0]} size={[1.4, 0.60, 1.4]} m={mat.plazaDark} shadow />

      {/* ── Top basin — bottom=3.40 → center=3.65 → top=3.90 ── */}
      <Box pos={[0, 3.65, 0]} size={[1.00, 0.50, 1.00]} m={mat.stone} shadow />
      <Box pos={[0, 3.88, 0]} size={[0.80, 0.05, 0.80]} m={mat.waterGlow} />

      {/* ── Central spire — bottom=3.90 → center=4.70 → top=5.50 ── */}
      <Box pos={[0, 4.70, 0]} size={[0.32, 1.60, 0.32]} m={mat.plazaDark} shadow />
      <Box pos={[0, 5.58, 0]} size={[0.22, 0.22, 0.22]} m={mat.waterGlow} />

      {/* ── Rotating crown ── */}
      <group ref={crownRef} position={[0, 5.74, 0]}>
        <Box pos={[0,  0.00, 0]} size={[0.92, 0.16, 0.92]} m={mat.stone} />
        <Box pos={[0,  0.24, 0]} size={[0.58, 0.48, 0.58]} m={mat.waterGlow} />
        <Box pos={[ 0.58, 0.06, 0]} size={[0.38, 0.10, 0.10]} m={mat.plazaAcc} />
        <Box pos={[-0.58, 0.06, 0]} size={[0.38, 0.10, 0.10]} m={mat.plazaAcc} />
        <Box pos={[0, 0.06,  0.58]} size={[0.10, 0.10, 0.38]} m={mat.plazaAcc} />
        <Box pos={[0, 0.06, -0.58]} size={[0.10, 0.10, 0.38]} m={mat.plazaAcc} />
      </group>

      {/* ── Orbiting water droplets ── */}
      <instancedMesh ref={dropsRef} args={[undefined, undefined, NDROP]} raycast={noRay}>
        <sphereGeometry args={[0.082, 7, 7]} />
        <primitive object={mat.droplet} attach="material" />
      </instancedMesh>
    </group>
  )
}

// ─── Mini roundabout / intersection feature ───────────────────────────────────
// Inner intersections are now at (±15, ±15) — midpoint between inner column (±9)
// and outer column (±21), i.e. road center between them at ±15.
function InnerRoundabout({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      {/* Stone circle — bottom at asphalt top (0.16) */}
      <Box pos={[0, 0.24, 0]} size={[3.0, 0.16, 3.0]} m={mat.plaza} />
      <Box pos={[0, 0.34, 0]} size={[2.4, 0.04, 2.4]} m={mat.grassDk} />
      {/* Central topiary */}
      <Box pos={[0, 0.63, 0]} size={[1.4, 0.56, 1.4]} m={mat.hedge} />
      <Box pos={[0, 1.03, 0]} size={[1.1, 0.44, 1.1]} m={mat.leaf2} />
      <Box pos={[0, 1.34, 0]} size={[0.7, 0.36, 0.7]} m={mat.leaf} />
    </group>
  )
}

// ─── Entrance approach ────────────────────────────────────────────────────────
// Gate wall at z=30, pillars z=29.5→30.5. Slab centered at z=27.5,
// depth 3.0 → z=26.0 to z=29.0, clear of pillars. Width 5.8 < GATE_SPAN=6.
function EntranceApproach() {
  return (
    <group position={[0, 0, 27.5]}>
      <Box pos={[0, 0.22, 0]} size={[5.8, 0.12, 3.0]} m={mat.plaza} />
      <Box pos={[0, 0.30, 0]} size={[4.0, 0.06, 2.0]} m={mat.plazaAcc} />
    </group>
  )
}

// ─── Street lamp ──────────────────────────────────────────────────────────────
// Placed at road intersections throughout the city.
function StreetLamp({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      {/* Base plinth */}
      <Box pos={[0, 0.14, 0]} size={[0.28, 0.28, 0.28]} m={mat.lampPost} />
      {/* Post */}
      <Box pos={[0, 2.28, 0]} size={[0.12, 4.20, 0.12]} m={mat.lampPost} />
      {/* Horizontal arm */}
      <Box pos={[0.46, 4.40, 0]} size={[0.92, 0.10, 0.10]} m={mat.lampPost} />
      {/* Lamp head housing */}
      <Box pos={[0.92, 4.28, 0]} size={[0.30, 0.24, 0.30]} m={mat.lampPost} />
      {/* Lamp glow (MeshBasicMaterial — always bright) */}
      <Box pos={[0.92, 4.28, 0]} size={[0.20, 0.14, 0.20]} m={mat.lamp} />
    </group>
  )
}

// ─── Road tree ────────────────────────────────────────────────────────────────
// Layered canopy with tapering silhouette.
function RoadTree({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Box pos={[0, 0.68, 0]} size={[0.26, 1.36, 0.26]} m={mat.trunk} />
      <Box pos={[0, 1.80, 0]} size={[1.24, 0.72, 1.24]} m={mat.leaf} />
      <Box pos={[0, 2.34, 0]} size={[0.92, 0.64, 0.92]} m={mat.leaf2} />
      <Box pos={[0, 2.80, 0]} size={[0.58, 0.52, 0.58]} m={mat.hedge} />
      <Box pos={[0, 3.12, 0]} size={[0.30, 0.30, 0.30]} m={mat.leaf} />
    </group>
  )
}

// ─── Plaza planter ────────────────────────────────────────────────────────────
// Small decorative planter box for open road areas near the fountain plaza.
function PlazaPlanter({ x, z }) {
  return (
    <group position={[x, 0, z]}>
      <Box pos={[0, 0.26, 0]} size={[0.88, 0.52, 0.88]} m={mat.planter} />
      <Box pos={[0, 0.54, 0]} size={[0.68, 0.08, 0.68]} m={mat.stone} />
      <Box pos={[0, 0.64, 0]} size={[0.52, 0.20, 0.52]} m={mat.grassDk} />
      <Box pos={[0, 0.80, 0]} size={[0.28, 0.24, 0.28]} m={mat.leaf2} />
    </group>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CityBoundary() {
  const wh = WALL_H
  const wy = wh / 2

  return (
    <group>
      {/* ── Single asphalt base ── */}
      <mesh position={[0, 0.08, 0]} receiveShadow raycast={noRay}>
        <boxGeometry args={[60, 0.16, 60]} />
        <primitive object={mat.asphalt} attach="material" />
      </mesh>

      {/* ── Perimeter walls ── */}
      {/* Front wall (z=+H): 2 segments with 6-unit gap at x=0 for entrance gate */}
      <WallSection pos={[-16.5, wy,  H]} size={[27, wh, 1.0]} />
      <WallSection pos={[ 16.5, wy,  H]} size={[27, wh, 1.0]} />
      {/* Side walls: unbroken */}
      <WallSection pos={[ H, wy, 0]} size={[1.0, wh, H * 2]} />
      <WallSection pos={[-H, wy, 0]} size={[1.0, wh, H * 2]} />
      {/* Back wall (z=−H): 5 segments with 6-unit gaps at x=−21,−9,+9,+21
       *  Gate at x=−21 spans [−24,−18]. Gate at x=−9 spans [−12,−6].
       *  Gate at x=+9  spans [+6,+12].  Gate at x=+21 spans [+18,+24].
       *  Segments fill: [−30,−24] [−18,−12] [−6,+6] [+12,+18] [+24,+30]
       *  Centers: −27 (w=6), −15 (w=6), 0 (w=12), +15 (w=6), +27 (w=6)  */}
      <WallSection pos={[-27, wy, -H]} size={[ 6, wh, 1.0]} />
      <WallSection pos={[-15, wy, -H]} size={[ 6, wh, 1.0]} />
      <WallSection pos={[  0, wy, -H]} size={[12, wh, 1.0]} />
      <WallSection pos={[ 15, wy, -H]} size={[ 6, wh, 1.0]} />
      <WallSection pos={[ 27, wy, -H]} size={[ 6, wh, 1.0]} />

      {/* ── Corner towers ── */}
      <CornerTower x={-H} z={-H} />
      <CornerTower x={ H} z={-H} />
      <CornerTower x={-H} z={ H} />
      <CornerTower x={ H} z={ H} />

      {/* ── 4 Park lots ── */}
      {PARK_LOTS.map(({ x, z }, i) => (
        <ParkLot key={i} x={x} z={z} variant={i} />
      ))}

      {/* ── Grand central fountain ── */}
      <CentralFountain />

      {/* ── Mini roundabouts at 4 inner intersections (±15, ±15) ── */}
      <InnerRoundabout x={-15} z={ 15} />
      <InnerRoundabout x={ 15} z={ 15} />
      <InnerRoundabout x={-15} z={-15} />
      <InnerRoundabout x={ 15} z={-15} />

      {/* ── Entrance approach ── */}
      <EntranceApproach />

      {/* ── Street lamps at outer-road / inner-road intersections ────────── */}
      {/* Along outer N-S roads (x=±27) crossing inner E-W roads (z=±15) and centre */}
      <StreetLamp x={ 27} z={ 15} />
      <StreetLamp x={ 27} z={-15} />
      <StreetLamp x={-27} z={ 15} />
      <StreetLamp x={-27} z={-15} />
      <StreetLamp x={ 27} z={  0} />
      <StreetLamp x={-27} z={  0} />
      {/* Along inner N-S roads (x=±15) crossing outer E-W roads (z=±27) */}
      <StreetLamp x={ 15} z={ 27} />
      <StreetLamp x={ 15} z={-27} />
      <StreetLamp x={-15} z={ 27} />
      <StreetLamp x={-15} z={-27} />

      {/* ── Trees at outer-road corner intersections (x=±27, z=±27) ───────── */}
      <RoadTree x={ 27} z={ 27} />
      <RoadTree x={ 27} z={-27} />
      <RoadTree x={-27} z={ 27} />
      <RoadTree x={-27} z={-27} />

      {/* ── Plaza planters flanking the fountain on the E-W axis ─────────── */}
      {/* Positioned in the road gap between fountain plaza (±4) and park lots (±5) */}
      <PlazaPlanter x={ 4.5} z={0} />
      <PlazaPlanter x={-4.5} z={0} />
      <PlazaPlanter x={0} z={ 4.5} />
      <PlazaPlanter x={0} z={-4.5} />
    </group>
  )
}
