/**
 * PortalScene — realistic night-city silhouette visible through every arch.
 *
 * Rendering technique:
 *   Each layer gets a distinct negative renderOrder (−10 … −2) so Three.js
 *   never re-sorts them by depth — the painter's order is always preserved.
 *   All materials use depthTest: false / depthWrite: false, so the arch stone
 *   (renderOrder 0, depthWrite true) paints over the portal wherever the piers
 *   are, leaving the arch opening as a clean window into the city-scape.
 *
 * Performance:
 *   Buildings and windows are batched into InstancedMesh objects (one draw-call
 *   per layer × colour), keeping the total under ~20 draw-calls per portal.
 */
import { useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'

const noRay = () => null

// ── Shared portal materials ───────────────────────────────────────────────────
const mkm = (color, opts = {}) => new THREE.MeshBasicMaterial({
  color, depthTest: false, depthWrite: false, side: THREE.DoubleSide, ...opts,
})

// Sky
const matSkyTop   = mkm('#020410')
const matSkyMid   = mkm('#05061a')
const matHGlowA   = mkm('#1a0b03', { transparent: true, opacity: 0.92 })  // deep orange pollution
const matHGlowB   = mkm('#3e1a06', { transparent: true, opacity: 0.75 })  // brighter orange band
const matHGlowC   = mkm('#6c3010', { transparent: true, opacity: 0.45 })  // bright crown of glow

// Buildings (back to front = darker to slightly lighter)
const matFarB  = mkm('#04041a')
const matMidB  = mkm('#0a0a22')
const matNearB = mkm('#131332')

// Windows
const matWinW = mkm('#ffcc44', { transparent: true, opacity: 0.90 })   // warm yellow
const matWinC = mkm('#88aaff', { transparent: true, opacity: 0.75 })   // cool blue
const matWinO = mkm('#ff9922', { transparent: true, opacity: 0.82 })   // orange (neon-ish)

// Ground
const matGnd   = mkm('#070705')
const matGGlow = mkm('#4a1e06', { transparent: true, opacity: 0.88 })  // warm street-light glow

// Decorative
const matStar = mkm('#ddeeff')
const matMoon = mkm('#f2e8cc')

// ── Static geometry (unit plane — scaled per instance) ────────────────────────
const UNIT_GEO = new THREE.PlaneGeometry(1, 1)

// ── City layout  [x_centre, width, height] ────────────────────────────────────
// All values in local gate space (arch centre = 0, y = 0 at ground)

const FAR_B = [
  [-1.20, 0.24, 3.40],   // skyscraper left
  [-0.92, 0.18, 2.20],   // thin mid-rise
  [-0.68, 0.30, 1.60],   // low block
  [-0.36, 0.22, 3.80],   // slim tower
  [-0.04, 0.20, 4.20],   // tallest central tower
  [ 0.24, 0.34, 2.40],   // medium block
  [ 0.60, 0.22, 3.00],   // right tower
  [ 0.86, 0.28, 1.80],   // mid block
  [ 1.10, 0.22, 2.60],   // tall right
  [ 1.30, 0.16, 1.40],   // short corner
]

const MID_B = [
  [-1.24, 0.18, 1.10],
  [-0.80, 0.28, 1.40],
  [-0.26, 0.42, 0.90],
  [ 0.30, 0.24, 1.60],
  [ 0.74, 0.26, 1.20],
  [ 1.18, 0.18, 1.00],
]

const NEAR_B = [
  [-1.22, 0.20, 0.82],
  [-0.55, 0.36, 1.20],
  [ 0.12, 0.46, 0.70],
  [ 0.72, 0.28, 1.00],
  [ 1.16, 0.20, 0.85],
]

// ── Window generation (deterministic — runs once at module load) ───────────────
function genWins(bldgs, xSpacing, ySpacing, maxCols, maxRows) {
  const warm = [], cool = [], hot = []
  for (const [bx, bw, bh] of bldgs) {
    const cols  = Math.max(1, Math.min(maxCols, Math.floor(bw / xSpacing)))
    const rows  = Math.max(1, Math.min(maxRows, Math.floor(bh / ySpacing)))
    const xOff  = (cols - 1) * xSpacing * 0.5
    const yBase = ySpacing * 0.55
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hA = Math.abs((bx * 37 | 0) + c * 7 + r * 11)
        if (hA % 3 === 0) continue               // ~1/3 windows dark
        const pos  = { x: bx - xOff + c * xSpacing, y: yBase + r * ySpacing }
        const hB   = Math.abs((bx * 73 | 0) + c * 19 + r * 23)
        if      (hB % 6 === 0) hot.push(pos)     // ~17 % orange
        else if (hB % 4 === 0) cool.push(pos)    // ~17 % cool blue
        else                   warm.push(pos)     // ~66 % warm yellow
      }
    }
  }
  return { warm, cool, hot }
}

// Window geometry per depth (different sizes for visual parallax)
const FAR_WIN_GEO  = new THREE.PlaneGeometry(0.082, 0.068)
const MID_WIN_GEO  = new THREE.PlaneGeometry(0.095, 0.080)
const NEAR_WIN_GEO = new THREE.PlaneGeometry(0.115, 0.095)

const FAR_WINS  = genWins(FAR_B,  0.112, 0.225, 2, 8)
const MID_WINS  = genWins(MID_B,  0.130, 0.255, 2, 6)
const NEAR_WINS = genWins(NEAR_B, 0.155, 0.290, 3, 5)

// Star positions [x, y]
const STARS = [
  [-1.12, 4.30], [-0.80, 3.74], [-0.44, 4.86], [-0.14, 3.52],
  [ 0.20, 4.62], [ 0.56, 5.10], [ 0.90, 4.02], [ 1.18, 4.58],
  [-0.62, 5.32], [ 0.40, 3.58],
]

// ── InstancedMesh helpers ─────────────────────────────────────────────────────
const _d = new THREE.Object3D()

/** Instanced planes scaled to each building's width × height */
function BldgLayer({ data, mat, z, ro }) {
  const ref = useRef()
  useLayoutEffect(() => {
    data.forEach(([bx, bw, bh], i) => {
      _d.position.set(bx, bh * 0.5, z)
      _d.scale.set(bw, bh, 1)
      _d.rotation.set(0, 0, 0)
      _d.updateMatrix()
      ref.current.setMatrixAt(i, _d.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh
      ref={ref}
      args={[UNIT_GEO, mat, data.length]}
      renderOrder={ro}
      raycast={noRay}
    />
  )
}

/** Instanced planes of fixed size, one per window position */
function WinLayer({ positions, geo, mat, z, ro }) {
  const ref = useRef()
  useLayoutEffect(() => {
    positions.forEach((p, i) => {
      _d.position.set(p.x, p.y, z)
      _d.scale.set(1, 1, 1)
      _d.rotation.set(0, 0, 0)
      _d.updateMatrix()
      ref.current.setMatrixAt(i, _d.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <instancedMesh
      ref={ref}
      args={[geo, mat, positions.length]}
      renderOrder={ro}
      raycast={noRay}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PortalScene() {
  return (
    <group>

      {/* ── Sky top (darkest, deepest) — ro −10 ── */}
      <mesh position={[0, 3.80, -0.78]} renderOrder={-10} raycast={noRay} material={matSkyTop}>
        <planeGeometry args={[2.92, 5.20]} />
      </mesh>

      {/* ── Sky mid tone — ro −9 ── */}
      <mesh position={[0, 2.20, -0.77]} renderOrder={-9} raycast={noRay} material={matSkyMid}>
        <planeGeometry args={[2.92, 3.80]} />
      </mesh>

      {/* ── Horizon glow (city light pollution) — ro −9 ── */}
      <mesh position={[0, 1.15, -0.76]} renderOrder={-9} raycast={noRay} material={matHGlowA}>
        <planeGeometry args={[2.92, 1.60]} />
      </mesh>
      <mesh position={[0, 1.40, -0.75]} renderOrder={-9} raycast={noRay} material={matHGlowB}>
        <planeGeometry args={[2.92, 0.90]} />
      </mesh>
      <mesh position={[0, 1.55, -0.74]} renderOrder={-9} raycast={noRay} material={matHGlowC}>
        <planeGeometry args={[2.92, 0.50]} />
      </mesh>

      {/* ── Stars — ro −9 ── */}
      {STARS.map(([sx, sy], i) => (
        <mesh key={i} position={[sx, sy, -0.77]} renderOrder={-9} raycast={noRay} material={matStar}>
          <planeGeometry args={[0.060, 0.060]} />
        </mesh>
      ))}

      {/* ── Moon — ro −9 ── */}
      <mesh position={[0.96, 4.68, -0.77]} renderOrder={-9} raycast={noRay} material={matMoon}>
        <planeGeometry args={[0.34, 0.34]} />
      </mesh>

      {/* ── Far buildings — ro −8 ── */}
      <BldgLayer data={FAR_B} mat={matFarB} z={-0.74} ro={-8} />

      {/* ── Far windows — ro −7 ── */}
      {FAR_WINS.warm.length > 0 && (
        <WinLayer positions={FAR_WINS.warm} geo={FAR_WIN_GEO} mat={matWinW} z={-0.73} ro={-7} />
      )}
      {FAR_WINS.cool.length > 0 && (
        <WinLayer positions={FAR_WINS.cool} geo={FAR_WIN_GEO} mat={matWinC} z={-0.73} ro={-7} />
      )}
      {FAR_WINS.hot.length > 0 && (
        <WinLayer positions={FAR_WINS.hot}  geo={FAR_WIN_GEO} mat={matWinO} z={-0.73} ro={-7} />
      )}

      {/* ── Mid buildings — ro −6 ── */}
      <BldgLayer data={MID_B} mat={matMidB} z={-0.69} ro={-6} />

      {/* ── Mid windows — ro −5 ── */}
      {MID_WINS.warm.length > 0 && (
        <WinLayer positions={MID_WINS.warm} geo={MID_WIN_GEO} mat={matWinW} z={-0.68} ro={-5} />
      )}
      {MID_WINS.cool.length > 0 && (
        <WinLayer positions={MID_WINS.cool} geo={MID_WIN_GEO} mat={matWinC} z={-0.68} ro={-5} />
      )}
      {MID_WINS.hot.length > 0 && (
        <WinLayer positions={MID_WINS.hot}  geo={MID_WIN_GEO} mat={matWinO} z={-0.68} ro={-5} />
      )}

      {/* ── Near buildings — ro −4 ── */}
      <BldgLayer data={NEAR_B} mat={matNearB} z={-0.64} ro={-4} />

      {/* ── Near windows — ro −3 ── */}
      {NEAR_WINS.warm.length > 0 && (
        <WinLayer positions={NEAR_WINS.warm} geo={NEAR_WIN_GEO} mat={matWinW} z={-0.62} ro={-3} />
      )}
      {NEAR_WINS.cool.length > 0 && (
        <WinLayer positions={NEAR_WINS.cool} geo={NEAR_WIN_GEO} mat={matWinC} z={-0.62} ro={-3} />
      )}
      {NEAR_WINS.hot.length > 0 && (
        <WinLayer positions={NEAR_WINS.hot}  geo={NEAR_WIN_GEO} mat={matWinO} z={-0.62} ro={-3} />
      )}

      {/* ── Ground & street glow — ro −2 ── */}
      <mesh position={[0, 0.18, -0.62]} renderOrder={-2} raycast={noRay} material={matGnd}>
        <planeGeometry args={[2.92, 0.38]} />
      </mesh>
      <mesh position={[0, 0.22, -0.60]} renderOrder={-2} raycast={noRay} material={matGGlow}>
        <planeGeometry args={[2.92, 0.20]} />
      </mesh>

    </group>
  )
}
