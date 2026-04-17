/**
 * Building — file skyscraper rendered on top of a lot slab.
 *
 * Size scales with file size (log10). Code files get a stepped/setback tower.
 * Floor belts are added every 1.2 units of height for a "stacked floors" look.
 * The group origin is at y=0 (ground), buildings are offset up to slab top.
 */
import { useRef, useMemo, useLayoutEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

// Shared scratch color — safe because JS is single-threaded (useFrame runs sequentially)
const _winColor  = new THREE.Color()
const _winDark   = new THREE.Color('#221100')
const _winBright = new THREE.Color('#ffaa44')

// ── Deterministic hash (DJB2) for rooftop variety ─────────────────────────────
function nameHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

// ── Module-level shared materials for rooftop details ─────────────────────────
const antennaMat   = new THREE.MeshLambertMaterial({ color: '#252525' })
const waterTankMat = new THREE.MeshLambertMaterial({ color: '#7a5a3a' })
const gardenMats   = [
  new THREE.MeshLambertMaterial({ color: '#2a8a1a' }),
  new THREE.MeshLambertMaterial({ color: '#33a020' }),
  new THREE.MeshLambertMaterial({ color: '#1e7a14' }),
]
const shrubMatA    = new THREE.MeshLambertMaterial({ color: '#2d7a1f' })
const shrubMatB    = new THREE.MeshLambertMaterial({ color: '#3a9427' })

// Lot slab top surface sits at this Y — buildings start here
const SLAB_TOP = 0.08 + 0.28  // asphalt y + slab height

const BELT_INTERVAL = 1.2   // floor belt every N units of height
const BELT_OVERHANG = 0.10  // how much wider belt is vs building body
const BELT_HEIGHT   = 0.08

// Code file extensions that get the stepped/setback tower shape
const STEPPED_EXTS = new Set(['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'c', 'cpp'])

// Per-extension visual style: body color, roof color, accent (belt + door) color
const EXT_STYLES = {
  js:   { body: '#3d8fe0', roof: '#1a5faa', accent: '#1e4a88' },
  jsx:  { body: '#2dd8f0', roof: '#0eaacc', accent: '#0a7a9a' },
  ts:   { body: '#6644cc', roof: '#442299', accent: '#331877' },
  tsx:  { body: '#8855ee', roof: '#5522bb', accent: '#4411aa' },
  py:   { body: '#44bb44', roof: '#228822', accent: '#116611' },
  go:   { body: '#00acd7', roof: '#007aa0', accent: '#005577' },
  rs:   { body: '#f74c00', roof: '#c03800', accent: '#902800' },
  c:    { body: '#5599cc', roof: '#336699', accent: '#224466' },
  cpp:  { body: '#4488bb', roof: '#2266aa', accent: '#114488' },
  json: { body: '#e6b800', roof: '#aa8800', accent: '#776600' },
  css:  { body: '#ff55aa', roof: '#cc2277', accent: '#990055' },
  html: { body: '#ff7733', roof: '#cc4400', accent: '#993300' },
  md:   { body: '#d8eedd', roof: '#9abca0', accent: '#6a8c72' },
  txt:  { body: '#f0ead8', roof: '#c0b898', accent: '#907868' },
  mp4:  { body: '#ff4422', roof: '#cc1100', accent: '#990000' },
  mov:  { body: '#ff6622', roof: '#cc3300', accent: '#991100' },
  avi:  { body: '#ff3311', roof: '#bb0000', accent: '#880000' },
  png:  { body: '#ff88cc', roof: '#cc4499', accent: '#992266' },
  jpg:  { body: '#ffaacc', roof: '#cc6688', accent: '#993355' },
  svg:  { body: '#ffcc44', roof: '#cc9900', accent: '#997700' },
}
const DEFAULT_STYLE = { body: '#b8b0a0', roof: '#887868', accent: '#665848' }

function getStyle(ext) {
  return EXT_STYLES[ext?.toLowerCase()] ?? DEFAULT_STYLE
}

function calcDimensions(sizeBytes, ext) {
  const raw = sizeBytes && sizeBytes > 0 ? Math.log10(Math.max(1, sizeBytes)) : 0
  // footprint: 2.5..5.0 units
  const base = Math.max(2.5, Math.min(5.0, 2.0 + raw * 0.55))
  // height: 1.5..10.0 units
  const height = Math.max(1.5, Math.min(10.0, raw * 2.5))
  // video files are wider and shallower
  const isVideo = ['mp4', 'mov', 'avi'].includes(ext?.toLowerCase())
  const w = isVideo ? Math.min(base * 1.3, 6.0) : base
  const d = isVideo ? Math.max(base * 0.7, 2.0) : base
  return { w, d, height }
}

// Compute Y positions of floor belts (skip top — that's the roof)
function beltYPositions(height) {
  const positions = []
  let y = BELT_INTERVAL
  while (y < height - 0.3) {
    positions.push(y)
    y += BELT_INTERVAL
  }
  return positions
}

function dispatchInspect(name, ext, size) {
  window.dispatchEvent(new CustomEvent('vfs-inspect', { detail: { name, ext, size } }))
}

export default function Building({ name, ext, size, x, z, showLabel, startDelay = 0 }) {
  const groupRef = useRef()
  const labelRef = useRef()
  const scaleProgress = useRef(0)
  const animDone = useRef(false)
  const hovered = useRef(false)
  const hoverY = useRef(0)
  const startAt = useRef(performance.now() + startDelay)
  const frameSkip = useRef(0)   // for window-flicker throttle

  const style = getStyle(ext)
  const { w, d, height } = useMemo(() => calcDimensions(size, ext), [size, ext])

  const isStepped = STEPPED_EXTS.has(ext?.toLowerCase())
  const lowerH  = height * 0.6
  const upperH  = height * 0.4
  const upperW  = w * 0.7
  const upperD  = d * 0.7
  const upperY  = lowerH + upperH / 2  // center of upper section above slab

  const beltsMain   = useMemo(() => beltYPositions(isStepped ? lowerH : height), [lowerH, height, isStepped])
  const beltsUpper  = useMemo(() => (isStepped ? beltYPositions(upperH).map(y => lowerH + y) : []), [lowerH, upperH, isStepped])

  const hasHVAC = size > 5000
  const roofY   = isStepped ? lowerH + upperH : height

  // Deterministic rooftop details — stable per file name
  const roofDetails = useMemo(() => {
    const h = nameHash(name)
    return {
      hasWaterTower:  (h % 4) === 0,
      hasAntenna:     (h % 2) === 0,
      hasRoofGarden:  (h % 5) === 0,
      hasSatellite:   (h % 7) === 0,
      // Antenna position + height
      antennaX:       ((h >> 4) % 3 - 1) * w * 0.26,
      antennaH:       0.72 + ((h >> 6) % 4) * 0.22,
      // Water tower side (+x or −x half of roof)
      waterTowerSide: (h & 1) ? 1 : -1,
      // Garden colour index (0–2)
      gardenMatIdx:   (h >> 3) % 3,
    }
  }, [name, w])

  const bodyMat   = useMemo(() => new THREE.MeshLambertMaterial({ color: style.body }), [style.body])
  const roofMat   = useMemo(() => new THREE.MeshLambertMaterial({
    color: style.roof,
    emissive: new THREE.Color(style.roof),
    emissiveIntensity: 0,
  }), [style.roof])
  const accentMat = useMemo(() => new THREE.MeshLambertMaterial({ color: style.accent }), [style.accent])
  const hvacMat   = useMemo(() => new THREE.MeshLambertMaterial({ color: '#333028' }), [])
  const doorMat   = useMemo(() => new THREE.MeshLambertMaterial({ color: '#111111' }), [])

  // Two window panes per building — MeshBasicMaterial has zero lighting overhead.
  // Color is lerped between dark/bright each frame instead of emissiveIntensity.
  const windowData = useMemo(() => {
    const xGap = w >= 3.5 ? w * 0.25 : w * 0.18
    const yPos  = Math.min(0.9, height * 0.28)
    return [
      { mat: new THREE.MeshBasicMaterial({ color: _winDark.clone() }), offset: Math.random() * Math.PI * 2, xOff: -xGap, yPos },
      { mat: new THREE.MeshBasicMaterial({ color: _winDark.clone() }), offset: Math.random() * Math.PI * 2, xOff:  xGap, yPos },
    ]
  }, [height, w])

  // Set initial scale to 0 imperatively — keeps React reconciliation from
  // resetting the group back to scale=0 whenever showLabels toggles or any
  // prop changes trigger a re-render (same fix applied to Gate / EntranceGate).
  useLayoutEffect(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(0)
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // ── Scale-in entrance ────────────────────────────────────────────────────
    if (!animDone.current) {
      if (performance.now() >= startAt.current) {
        scaleProgress.current = Math.min(1, scaleProgress.current + delta * 2.5)
        groupRef.current.scale.setScalar(scaleProgress.current)
        if (scaleProgress.current >= 1) animDone.current = true
      }
      // Still run window flicker even during entrance so lights come on together
    }

    // ── Hover lift + roof glow ───────────────────────────────────────────────
    if (animDone.current) {
      const isHov = hovered.current
      if (isHov || hoverY.current > 0.001 || roofMat.emissiveIntensity > 0.001) {
        const lf = Math.min(1, delta * 7)
        hoverY.current = THREE.MathUtils.lerp(hoverY.current, isHov ? 0.4 : 0, lf)
        groupRef.current.position.y = SLAB_TOP + hoverY.current
        roofMat.emissiveIntensity = THREE.MathUtils.lerp(
          roofMat.emissiveIntensity, isHov ? 0.55 : 0, lf,
        )
      }
    }

    // ── Label pulse ──────────────────────────────────────────────────────────
    if (showLabel && labelRef.current) {
      labelRef.current.fillOpacity = 0.7 + Math.sin(performance.now() / 333) * 0.3
    }

    // ── Window flicker — throttled to every 2nd frame (imperceptible at 60 fps)
    frameSkip.current ^= 1
    if (frameSkip.current === 0) {
      const t = performance.now() / 1000
      for (let i = 0; i < windowData.length; i++) {
        const { mat, offset } = windowData[i]
        const bright = 0.15 + 0.35 * Math.max(0, Math.sin(t * 0.6 + offset))
        _winColor.lerpColors(_winDark, _winBright, bright)
        mat.color.copy(_winColor)
      }
    }
  })

  return (
    <group
      ref={groupRef}
      position={[x, SLAB_TOP, z]}
      onPointerEnter={() => { hovered.current = true }}
      onPointerLeave={() => { hovered.current = false }}
      onClick={e => { e.stopPropagation(); dispatchInspect(name, ext, size) }}
      style={{ cursor: 'pointer' }}
    >

      {isStepped ? (
        <>
          {/* Lower section — full width */}
          <mesh position={[0, lowerH / 2, 0]} castShadow material={bodyMat}>
            <boxGeometry args={[w, lowerH, d]} />
          </mesh>

          {/* Upper section — narrower */}
          <mesh position={[0, upperY, 0]} castShadow material={bodyMat}>
            <boxGeometry args={[upperW, upperH, upperD]} />
          </mesh>

          {/* Floor belts on lower section */}
          {beltsMain.map(by => (
            <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[w + BELT_OVERHANG, BELT_HEIGHT, d + BELT_OVERHANG]} />
            </mesh>
          ))}

          {/* Floor belts on upper section */}
          {beltsUpper.map(by => (
            <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[upperW + BELT_OVERHANG, BELT_HEIGHT, upperD + BELT_OVERHANG]} />
            </mesh>
          ))}

          {/* Setback slab between lower and upper */}
          <mesh position={[0, lowerH, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[w + 0.18, 0.14, d + 0.18]} />
          </mesh>

          {/* Roof cap on upper section */}
          <mesh position={[0, roofY + 0.07, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[upperW + 0.18, 0.14, upperD + 0.18]} />
          </mesh>
        </>
      ) : (
        <>
          {/* Simple tower body */}
          <mesh position={[0, height / 2, 0]} castShadow material={bodyMat}>
            <boxGeometry args={[w, height, d]} />
          </mesh>

          {/* Floor belts */}
          {beltsMain.map(by => (
            <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[w + BELT_OVERHANG, BELT_HEIGHT, d + BELT_OVERHANG]} />
            </mesh>
          ))}

          {/* Roof slab */}
          <mesh position={[0, roofY + 0.07, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[w + 0.22, 0.14, d + 0.22]} />
          </mesh>
        </>
      )}

      {/* HVAC box on roof (for larger files) — no shadow: too small to matter */}
      {hasHVAC && (
        <mesh position={[w * 0.2, roofY + 0.22, d * 0.2]} material={hvacMat} raycast={() => null}>
          <boxGeometry args={[w * 0.3, 0.35, d * 0.3]} />
        </mesh>
      )}

      {/* ── Rooftop: water tower (1 in 4 buildings) ── */}
      {roofDetails.hasWaterTower && (
        <group position={[roofDetails.waterTowerSide * w * 0.24, roofY, 0]} raycast={() => null}>
          {/* Four support legs */}
          {[[-0.15, -0.14], [0.15, -0.14], [-0.15, 0.14], [0.15, 0.14]].map(([lx, lz], li) => (
            <mesh key={li} position={[lx, 0.24, lz]} material={antennaMat} raycast={() => null}>
              <boxGeometry args={[0.06, 0.48, 0.06]} />
            </mesh>
          ))}
          {/* Tank body */}
          <mesh position={[0, 0.57, 0]} material={waterTankMat} raycast={() => null}>
            <boxGeometry args={[0.46, 0.40, 0.46]} />
          </mesh>
          {/* Tank lid */}
          <mesh position={[0, 0.79, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.52, 0.07, 0.52]} />
          </mesh>
        </group>
      )}

      {/* ── Rooftop: antenna (1 in 2 buildings) ── */}
      {roofDetails.hasAntenna && (
        <group position={[roofDetails.antennaX, roofY, d * 0.14]} raycast={() => null}>
          {/* Pole */}
          <mesh position={[0, roofDetails.antennaH / 2, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.06, roofDetails.antennaH, 0.06]} />
          </mesh>
          {/* Tip disc */}
          <mesh position={[0, roofDetails.antennaH, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.18, 0.05, 0.18]} />
          </mesh>
          {/* Crossbar */}
          <mesh position={[0, roofDetails.antennaH * 0.64, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.30, 0.04, 0.04]} />
          </mesh>
        </group>
      )}

      {/* ── Rooftop: garden (1 in 5 buildings) ── */}
      {roofDetails.hasRoofGarden && (
        <group position={[w * 0.10, roofY + 0.07, 0]} raycast={() => null}>
          {/* Soil bed */}
          <mesh position={[0, 0.06, 0]} material={gardenMats[roofDetails.gardenMatIdx]} raycast={() => null}>
            <boxGeometry args={[Math.min(w * 0.44, 2.2), 0.12, Math.min(d * 0.44, 2.2)]} />
          </mesh>
          {/* Shrubs */}
          <mesh position={[-0.30, 0.22, 0.12]} material={shrubMatA} raycast={() => null}>
            <boxGeometry args={[0.22, 0.22, 0.22]} />
          </mesh>
          <mesh position={[ 0.28, 0.20, -0.16]} material={shrubMatB} raycast={() => null}>
            <boxGeometry args={[0.20, 0.20, 0.20]} />
          </mesh>
        </group>
      )}

      {/* ── Rooftop: satellite dish (1 in 7 buildings) ── */}
      {roofDetails.hasSatellite && (
        <group position={[-w * 0.22, roofY, d * 0.16]} raycast={() => null}>
          {/* Mast */}
          <mesh position={[0, 0.28, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.07, 0.56, 0.07]} />
          </mesh>
          {/* Dish plate — slightly tilted toward sky */}
          <mesh position={[0, 0.54, 0.09]} rotation={[0.45, 0, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.40, 0.40, 0.06]} />
          </mesh>
          {/* Feed horn */}
          <mesh position={[0, 0.56, 0.18]} material={accentMat} raycast={() => null}>
            <boxGeometry args={[0.08, 0.08, 0.07]} />
          </mesh>
        </group>
      )}

      {/* Door on south face (positive Z = toward camera) */}
      <mesh position={[0, 0.38, d / 2 + 0.04]} material={doorMat} raycast={() => null}>
        <boxGeometry args={[0.5, 0.75, 0.06]} />
      </mesh>

      {/* Ambient window panes — emissive flicker in useFrame */}
      {windowData.map((wd, i) => (
        <mesh key={i} position={[wd.xOff, wd.yPos, d / 2 + 0.03]} material={wd.mat} raycast={() => null}>
          <boxGeometry args={[0.28, 0.32, 0.04]} />
        </mesh>
      ))}

      {showLabel && (
        <Text
          ref={labelRef}
          position={[0, roofY + 0.9, 0]}
          fontSize={0.4}
          color="#111111"
          outlineColor="#ffffff"
          outlineWidth={0.04}
          anchorX="center"
          anchorY="bottom"
          billboard
        >
          {name}
        </Text>
      )}
    </group>
  )
}
