/**
 * Building — file-driven city building with 5 archetypes.
 *
 * Archetype is determined by file extension:
 *   office      → 3-tier setback glass tower  (code files)
 *   civic       → square block with parapet + flag  (config files)
 *   commercial  → short wide block with awning  (markup/text)
 *   residential → medium block with balcony rows  (image files)
 *   industrial  → low wide block with roof ridges  (media files)
 *   default     → simple mid-rise slab
 *
 * All archetypes stay color-coded by exact extension (EXT_STYLES).
 * Building group origin is at y=0; buildings sit on SLAB_TOP.
 * Max footprint: 7.4 × 7.4 (LOT_SIZE=8 minus 0.3 margin per side).
 */
import { useRef, useMemo, useLayoutEffect, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

// ── Scratch objects (module-level, never recreated) ───────────────────────────
const _winColor  = new THREE.Color()
const _winDark   = new THREE.Color('#1a1408')
const _winBright = new THREE.Color('#ffcc66')

// ── Deterministic hash (DJB2) ─────────────────────────────────────────────────
function nameHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

// ── Archetype mapping ─────────────────────────────────────────────────────────
const ARCHETYPE_SETS = {
  office:      new Set(['js','jsx','ts','tsx','py','go','rs','c','cpp','java','rb','php','swift','kt','cs','dart','lua','scala','clj','ex','exs']),
  civic:       new Set(['json','yaml','yml','toml','xml','env','ini','cfg','conf','lock','sh','bash','zsh','fish','ps1','makefile','dockerfile','gitignore']),
  commercial:  new Set(['html','css','scss','less','sass','md','txt','rst','csv','tsv','log']),
  residential: new Set(['png','jpg','jpeg','svg','gif','ico','webp','bmp','tiff','psd','ai','fig']),
  industrial:  new Set(['mp4','mov','avi','mkv','mp3','wav','ogg','flac','wasm','bin','exe','dll','so','dylib','zip','tar','gz','rar','7z']),
}

function getArchetype(ext) {
  const e = ext?.toLowerCase()
  for (const [type, set] of Object.entries(ARCHETYPE_SETS)) {
    if (set.has(e)) return type
  }
  return 'default'
}

// ── Per-extension colour palette ──────────────────────────────────────────────
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
  yaml: { body: '#d4aa00', roof: '#997700', accent: '#665500' },
  yml:  { body: '#d4aa00', roof: '#997700', accent: '#665500' },
  toml: { body: '#cc9900', roof: '#886600', accent: '#554400' },
  xml:  { body: '#cc7722', roof: '#994400', accent: '#662200' },
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

// ── Dimension calculator (per archetype) ──────────────────────────────────────
// All footprints capped at 7.4 so buildings never overflow their 8×8 lot slab.
function calcDimensions(sizeBytes, ext) {
  const raw      = sizeBytes > 0 ? Math.log10(Math.max(1, sizeBytes)) : 0
  const archetype = getArchetype(ext)
  let base, height, wScale = 1, dScale = 1

  switch (archetype) {
    case 'office':
      // Tall, slim glass tower
      base   = Math.max(2.0, Math.min(4.0, 1.6 + raw * 0.38))
      height = Math.max(3.5, Math.min(14.0, raw * 3.2))
      break
    case 'civic':
      // Square, stocky civic building
      base   = Math.max(3.2, Math.min(5.4, 2.5 + raw * 0.55))
      height = Math.max(2.2, Math.min(7.0, raw * 1.75))
      break
    case 'commercial':
      // Short, wide commercial block
      base   = Math.max(3.0, Math.min(4.8, 2.4 + raw * 0.55))
      height = Math.max(1.5, Math.min(5.0, raw * 1.3))
      wScale = 1.30; dScale = 0.75
      break
    case 'residential':
      // Medium height, slightly deep
      base   = Math.max(2.5, Math.min(4.4, 2.0 + raw * 0.48))
      height = Math.max(2.2, Math.min(9.0, raw * 2.1))
      wScale = 0.82; dScale = 1.10
      break
    case 'industrial':
      // Low, very wide warehouse
      base   = Math.max(3.8, Math.min(5.4, 3.0 + raw * 0.5))
      height = Math.max(1.5, Math.min(4.0, raw * 1.0))
      wScale = 1.45; dScale = 0.72
      break
    default:
      base   = Math.max(2.5, Math.min(5.0, 2.0 + raw * 0.55))
      height = Math.max(1.5, Math.min(10.0, raw * 2.5))
  }

  const w = Math.min(base * wScale, 7.4)
  const d = Math.min(base * dScale, 7.4)
  return { w, d, height, archetype }
}

// ── Belt helpers ──────────────────────────────────────────────────────────────
const BELT_INTERVAL = 1.2
const BELT_OVERHANG = 0.10
const BELT_H        = 0.08

function beltYPositions(sectionHeight, interval = BELT_INTERVAL) {
  const out = []
  let y = interval
  while (y < sectionHeight - 0.3) { out.push(y); y += interval }
  return out
}

function dispatchInspect(name, ext, size) {
  window.dispatchEvent(new CustomEvent('vfs-inspect', { detail: { name, ext, size } }))
}

// ── Module-level shared materials ─────────────────────────────────────────────
const antennaMat   = new THREE.MeshLambertMaterial({ color: '#252525' })
const waterTankMat = new THREE.MeshLambertMaterial({ color: '#7a5a3a' })
const gardenMats   = [
  new THREE.MeshLambertMaterial({ color: '#2a8a1a' }),
  new THREE.MeshLambertMaterial({ color: '#33a020' }),
  new THREE.MeshLambertMaterial({ color: '#1e7a14' }),
]
const flagRedMat   = new THREE.MeshLambertMaterial({ color: '#cc2222' })
const flagWhiteMat = new THREE.MeshLambertMaterial({ color: '#f0f0ee' })
const doorMat      = new THREE.MeshLambertMaterial({ color: '#111111' })
const pvMat        = new THREE.MeshLambertMaterial({ color: '#2a3855' })  // solar panel blue
const concreteMat  = new THREE.MeshLambertMaterial({ color: '#9a9590' })  // parapet concrete

// Lot slab top — buildings sit here (y = asphalt_base_y + slab_height)
const SLAB_TOP = 0.36

const DEMOLISH_MS = 1200  // must be < TerminalHUD rm delay (1400 ms)

export default function Building({ name, ext, size = 0, x, z, showLabel, startDelay = 0, demolishing = false }) {
  const groupRef      = useRef()
  const labelRef      = useRef()
  const scaleProgress = useRef(0)
  const animDone      = useRef(false)
  const hovered       = useRef(false)
  const hoverY        = useRef(0)
  const startAt       = useRef(performance.now() + startDelay)
  const frameSkip     = useRef(0)
  const demolishAt    = useRef(null)

  const style = getStyle(ext)
  const { w, d, height, archetype } = useMemo(() => calcDimensions(size, ext), [size, ext])

  // ── Per-archetype tier geometry (office only) ─────────────────────────────
  const tiers = useMemo(() => {
    if (archetype !== 'office') return null
    const t1H = height * 0.55
    const t2H = height * 0.28
    const t3H = height * 0.17
    return {
      t1H, t2H, t3H,
      t2W: w * 0.70, t2D: d * 0.70,
      t3W: w * 0.50, t3D: d * 0.50,
      t2CY: t1H + t2H / 2,
      t3CY: t1H + t2H + t3H / 2,
    }
  }, [archetype, height, w, d])

  // ── Belt positions ────────────────────────────────────────────────────────
  const beltsMain = useMemo(() => {
    if (archetype === 'office')      return tiers ? beltYPositions(tiers.t1H) : []
    if (archetype === 'civic')       return beltYPositions(height, 0.82)    // denser
    if (archetype === 'industrial')  return []                               // no belts
    return beltYPositions(height)
  }, [archetype, height, tiers])

  const beltsMid = useMemo(() => {
    if (archetype !== 'office' || !tiers) return []
    return beltYPositions(tiers.t2H).map(y => y + tiers.t1H)
  }, [archetype, tiers])

  // roofY = top of the main building mass (where rooftop details start)
  const roofY = height

  // Roof footprint for rooftop detail placement (office uses top tier)
  const roofW = archetype === 'office' && tiers ? tiers.t3W : w
  const roofD = archetype === 'office' && tiers ? tiers.t3D : d

  // ── Rooftop variety (deterministic) ──────────────────────────────────────
  const roofDetails = useMemo(() => {
    const h = nameHash(name)
    return {
      hasWaterTower: (h % 4) === 0,
      hasAntenna:    (h % 2) === 0,
      hasRoofGarden: (h % 5) === 0,
      hasSatellite:  (h % 7) === 0,
      antennaX:      ((h >> 4) % 3 - 1) * roofW * 0.28,
      antennaH:      0.72 + ((h >> 6) % 4) * 0.22,
      waterTankSide: (h & 1) ? 1 : -1,
      gardenMatIdx:  (h >> 3) % 3,
      flagSide:      (h & 2) ? 1 : -1,
    }
  }, [name, roofW])

  // Filter rooftop details by archetype
  const showWaterTower  = roofDetails.hasWaterTower  && ['office', 'residential', 'default'].includes(archetype)
  const showAntenna     = roofDetails.hasAntenna     && ['office', 'default'].includes(archetype)
  const showRoofGarden  = roofDetails.hasRoofGarden  && ['office', 'residential'].includes(archetype)
  const showSatellite   = roofDetails.hasSatellite   && ['office', 'default'].includes(archetype)
  const showHVAC        = size > 5000                && ['office', 'industrial', 'civic'].includes(archetype)

  // ── Materials (per-instance, cached) ──────────────────────────────────────
  const bodyMat   = useMemo(() => new THREE.MeshLambertMaterial({ color: style.body }), [style.body])
  const roofMat   = useMemo(() => new THREE.MeshLambertMaterial({
    color: style.roof,
    emissive: new THREE.Color(style.roof),
    emissiveIntensity: 0,
  }), [style.roof])
  const accentMat = useMemo(() => new THREE.MeshLambertMaterial({ color: style.accent }), [style.accent])
  const hvacMat   = useMemo(() => new THREE.MeshLambertMaterial({ color: '#333028' }), [])

  // ── Window data (deterministic, south + east face) ────────────────────────
  // "keep simple" — 2 south-face panes + 1 east-face pane, improved y position
  const windowData = useMemo(() => {
    const h    = nameHash(name)
    const xGap = w >= 3.5 ? w * 0.22 : w * 0.18
    const yPos = Math.max(0.8, height * 0.44)  // upper-middle of building
    return [
      {
        mat:    new THREE.MeshBasicMaterial({ color: _winDark.clone() }),
        offset: ((h * 7 + 13) % 628) / 100,
        pos:    [-xGap, yPos, d / 2 + 0.03],
        args:   [0.28, 0.32, 0.04],
      },
      {
        mat:    new THREE.MeshBasicMaterial({ color: _winDark.clone() }),
        offset: ((h * 3 + 77) % 628) / 100,
        pos:    [ xGap, yPos, d / 2 + 0.03],
        args:   [0.28, 0.32, 0.04],
      },
      // East-face window (visible in isometric view)
      {
        mat:    new THREE.MeshBasicMaterial({ color: _winDark.clone() }),
        offset: ((h * 11 + 33) % 628) / 100,
        pos:    [w / 2 + 0.03, yPos, 0],
        args:   [0.04, 0.32, 0.28],
      },
    ]
  }, [name, height, w, d])

  // ── Residential balcony floor positions ───────────────────────────────────
  const balconyFloors = useMemo(() => {
    if (archetype !== 'residential') return []
    const floors = []
    let y = 1.1
    while (y < height - 0.8) { floors.push(y); y += 1.4 }
    return floors
  }, [archetype, height])

  // ── Scale-in entrance animation (set to 0 imperatively) ──────────────────
  useLayoutEffect(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(0)
  }, [])

  // ── Demolition: record when shrink should start ───────────────────────────
  useEffect(() => {
    if (demolishing && demolishAt.current === null) {
      demolishAt.current = performance.now()
    }
  }, [demolishing])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Demolish shrink-out — cubic ease-in so building stays visible while
    // dust billows, then collapses rapidly in the final stretch.
    if (demolishAt.current !== null) {
      const t = Math.min(1, (performance.now() - demolishAt.current) / DEMOLISH_MS)
      groupRef.current.scale.setScalar(Math.max(0, 1 - t * t * t))
      return
    }

    // Scale-in
    if (!animDone.current) {
      if (performance.now() >= startAt.current) {
        scaleProgress.current = Math.min(1, scaleProgress.current + delta * 2.5)
        groupRef.current.scale.setScalar(scaleProgress.current)
        if (scaleProgress.current >= 1) animDone.current = true
      }
    }

    // Hover lift + roof emissive glow
    if (animDone.current) {
      const isHov = hovered.current
      if (isHov || hoverY.current > 0.001 || roofMat.emissiveIntensity > 0.001) {
        const lf = Math.min(1, delta * 7)
        hoverY.current = THREE.MathUtils.lerp(hoverY.current, isHov ? 0.4 : 0, lf)
        groupRef.current.position.y = SLAB_TOP + hoverY.current
        roofMat.emissiveIntensity   = THREE.MathUtils.lerp(
          roofMat.emissiveIntensity, isHov ? 0.55 : 0, lf,
        )
      }
    }

    // Label pulse
    if (showLabel && labelRef.current) {
      labelRef.current.fillOpacity = 0.7 + Math.sin(performance.now() / 333) * 0.3
    }

    // Window flicker (every 2nd frame)
    frameSkip.current ^= 1
    if (frameSkip.current === 0) {
      const t = performance.now() / 1000
      for (let i = 0; i < windowData.length; i++) {
        const { mat, offset } = windowData[i]
        const bright = 0.15 + 0.40 * Math.max(0, Math.sin(t * 0.55 + offset))
        _winColor.lerpColors(_winDark, _winBright, bright)
        mat.color.copy(_winColor)
      }
    }
  })

  // ── Shared door (on south face, all archetypes except industrial) ──────────
  const doorH = archetype === 'commercial' ? 1.0 : 0.75
  const doorW = archetype === 'commercial' ? 0.65 : 0.50

  return (
    <group
      ref={groupRef}
      position={[x, SLAB_TOP, z]}
      onPointerEnter={() => { hovered.current = true }}
      onPointerLeave={() => { hovered.current = false }}
      onClick={e => { e.stopPropagation(); dispatchInspect(name, ext, size) }}
    >

      {/* ── OFFICE: 3-tier setback glass tower ────────────────────────────── */}
      {archetype === 'office' && tiers && (() => {
        const { t1H, t2H, t3H, t2W, t2D, t3W, t3D, t2CY, t3CY } = tiers
        return (
          <>
            {/* Tier 1 — base */}
            <mesh position={[0, t1H / 2, 0]} castShadow material={bodyMat}>
              <boxGeometry args={[w, t1H, d]} />
            </mesh>
            {beltsMain.map(by => (
              <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
                <boxGeometry args={[w + BELT_OVERHANG, BELT_H, d + BELT_OVERHANG]} />
              </mesh>
            ))}

            {/* Setback slab 1 */}
            <mesh position={[0, t1H, 0]} castShadow material={roofMat} raycast={() => null}>
              <boxGeometry args={[w + 0.18, 0.12, d + 0.18]} />
            </mesh>

            {/* Tier 2 — mid */}
            <mesh position={[0, t2CY, 0]} castShadow material={bodyMat}>
              <boxGeometry args={[t2W, t2H, t2D]} />
            </mesh>
            {beltsMid.map(by => (
              <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
                <boxGeometry args={[t2W + BELT_OVERHANG, BELT_H, t2D + BELT_OVERHANG]} />
              </mesh>
            ))}

            {/* Setback slab 2 */}
            <mesh position={[0, t1H + t2H, 0]} castShadow material={roofMat} raycast={() => null}>
              <boxGeometry args={[t2W + 0.14, 0.10, t2D + 0.14]} />
            </mesh>

            {/* Tier 3 — top spire */}
            <mesh position={[0, t3CY, 0]} castShadow material={bodyMat}>
              <boxGeometry args={[t3W, t3H, t3D]} />
            </mesh>

            {/* Roof cap on spire */}
            <mesh position={[0, roofY + 0.07, 0]} castShadow material={roofMat} raycast={() => null}>
              <boxGeometry args={[t3W + 0.15, 0.12, t3D + 0.15]} />
            </mesh>
          </>
        )
      })()}

      {/* ── CIVIC: square block with parapet + columns + flag ─────────────── */}
      {archetype === 'civic' && (
        <>
          {/* Main block */}
          <mesh position={[0, height / 2, 0]} castShadow material={bodyMat}>
            <boxGeometry args={[w, height, d]} />
          </mesh>

          {/* Dense floor belts */}
          {beltsMain.map(by => (
            <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[w + BELT_OVERHANG, BELT_H + 0.02, d + BELT_OVERHANG]} />
            </mesh>
          ))}

          {/* Facade pilasters — 3 columns on south face */}
          {[-w * 0.30, 0, w * 0.30].map((px, i) => (
            <mesh key={i} position={[px, height / 2, d / 2 + 0.06]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[0.18, height * 0.92, 0.10]} />
            </mesh>
          ))}

          {/* Roof cap */}
          <mesh position={[0, roofY + 0.07, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[w + 0.20, 0.14, d + 0.20]} />
          </mesh>

          {/* Parapet (4 sides) */}
          <mesh position={[0, roofY + 0.31, -d / 2]} material={concreteMat} raycast={() => null}>
            <boxGeometry args={[w + 0.10, 0.40, 0.14]} />
          </mesh>
          <mesh position={[0, roofY + 0.31,  d / 2]} material={concreteMat} raycast={() => null}>
            <boxGeometry args={[w + 0.10, 0.40, 0.14]} />
          </mesh>
          <mesh position={[-w / 2, roofY + 0.31, 0]} material={concreteMat} raycast={() => null}>
            <boxGeometry args={[0.14, 0.40, d + 0.10]} />
          </mesh>
          <mesh position={[ w / 2, roofY + 0.31, 0]} material={concreteMat} raycast={() => null}>
            <boxGeometry args={[0.14, 0.40, d + 0.10]} />
          </mesh>

          {/* Flag pole */}
          <mesh position={[roofDetails.flagSide * w * 0.28, roofY + 0.51 + 0.70, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.07, 1.40, 0.07]} />
          </mesh>
          {/* Flag */}
          <mesh position={[roofDetails.flagSide * (w * 0.28 + 0.28), roofY + 0.51 + 1.18, 0]} material={flagRedMat} raycast={() => null}>
            <boxGeometry args={[0.52, 0.26, 0.04]} />
          </mesh>
          <mesh position={[roofDetails.flagSide * (w * 0.28 + 0.28), roofY + 0.51 + 1.38, 0]} material={flagWhiteMat} raycast={() => null}>
            <boxGeometry args={[0.52, 0.10, 0.04]} />
          </mesh>
        </>
      )}

      {/* ── COMMERCIAL: short wide block with awning + sign band ──────────── */}
      {archetype === 'commercial' && (
        <>
          {/* Main block */}
          <mesh position={[0, height / 2, 0]} castShadow material={bodyMat}>
            <boxGeometry args={[w, height, d]} />
          </mesh>

          {/* Floor belts */}
          {beltsMain.map(by => (
            <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[w + BELT_OVERHANG, BELT_H, d + BELT_OVERHANG]} />
            </mesh>
          ))}

          {/* Ground-floor darker base band */}
          <mesh position={[0, 0.55, d / 2 + 0.03]} material={accentMat} raycast={() => null}>
            <boxGeometry args={[w, 1.10, 0.05]} />
          </mesh>

          {/* Awning (horizontal overhang above ground floor) */}
          <mesh position={[0, 1.18, d / 2 + 0.30]} material={roofMat} raycast={() => null}>
            <boxGeometry args={[w * 0.85, 0.09, 0.60]} />
          </mesh>
          {/* Awning supports */}
          {[-w * 0.28, 0, w * 0.28].map((px, i) => (
            <mesh key={i} position={[px, 0.72, d / 2 + 0.22]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[0.06, 0.92, 0.06]} />
            </mesh>
          ))}

          {/* Sign band above awning */}
          <mesh position={[0, 1.52, d / 2 + 0.04]} material={bodyMat} raycast={() => null}>
            <boxGeometry args={[w * 0.75, 0.32, 0.06]} />
          </mesh>
          <mesh position={[0, 1.52, d / 2 + 0.07]} material={roofMat} raycast={() => null}>
            <boxGeometry args={[w * 0.60, 0.18, 0.04]} />
          </mesh>

          {/* Roof cap */}
          <mesh position={[0, roofY + 0.07, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[w + 0.18, 0.12, d + 0.18]} />
          </mesh>
        </>
      )}

      {/* ── RESIDENTIAL: medium block with balcony rows ────────────────────── */}
      {archetype === 'residential' && (
        <>
          {/* Main block */}
          <mesh position={[0, height / 2, 0]} castShadow material={bodyMat}>
            <boxGeometry args={[w, height, d]} />
          </mesh>

          {/* Floor belts */}
          {beltsMain.map(by => (
            <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[w + BELT_OVERHANG, BELT_H, d + BELT_OVERHANG]} />
            </mesh>
          ))}

          {/* Balcony rows on south face */}
          {balconyFloors.map(fy => (
            <group key={fy}>
              {/* Balcony slab */}
              <mesh position={[0, fy, d / 2 + 0.14]} material={accentMat} raycast={() => null}>
                <boxGeometry args={[w * 0.58, 0.07, 0.28]} />
              </mesh>
              {/* Railing */}
              <mesh position={[0, fy + 0.14, d / 2 + 0.26]} material={concreteMat} raycast={() => null}>
                <boxGeometry args={[w * 0.58, 0.20, 0.04]} />
              </mesh>
            </group>
          ))}

          {/* Thin parapet on roof */}
          <mesh position={[0, roofY + 0.15,  d / 2]} material={concreteMat} raycast={() => null}>
            <boxGeometry args={[w + 0.08, 0.28, 0.10]} />
          </mesh>
          <mesh position={[0, roofY + 0.15, -d / 2]} material={concreteMat} raycast={() => null}>
            <boxGeometry args={[w + 0.08, 0.28, 0.10]} />
          </mesh>
          <mesh position={[-w / 2, roofY + 0.15, 0]} material={concreteMat} raycast={() => null}>
            <boxGeometry args={[0.10, 0.28, d + 0.08]} />
          </mesh>
          <mesh position={[ w / 2, roofY + 0.15, 0]} material={concreteMat} raycast={() => null}>
            <boxGeometry args={[0.10, 0.28, d + 0.08]} />
          </mesh>

          {/* Roof cap */}
          <mesh position={[0, roofY + 0.06, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[w + 0.16, 0.10, d + 0.16]} />
          </mesh>
        </>
      )}

      {/* ── INDUSTRIAL: low wide block with roof ridges + dock ────────────── */}
      {archetype === 'industrial' && (
        <>
          {/* Main block */}
          <mesh position={[0, height / 2, 0]} castShadow material={bodyMat}>
            <boxGeometry args={[w, height, d]} />
          </mesh>

          {/* Horizontal banding (just 1–2 thick belts) */}
          {beltYPositions(height, 1.4).map(by => (
            <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[w + 0.08, 0.12, d + 0.08]} />
            </mesh>
          ))}

          {/* Roof ridges — stepped (outer higher, center lower) */}
          <mesh position={[-w * 0.30, roofY + 0.27, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[w * 0.28, 0.54, d * 0.90]} />
          </mesh>
          <mesh position={[0, roofY + 0.16, 0]} castShadow material={accentMat} raycast={() => null}>
            <boxGeometry args={[w * 0.28, 0.32, d * 0.90]} />
          </mesh>
          <mesh position={[ w * 0.30, roofY + 0.27, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[w * 0.28, 0.54, d * 0.90]} />
          </mesh>

          {/* Loading dock on south face */}
          <mesh position={[w * 0.28, 0.40, d / 2 + 0.05]} material={doorMat} raycast={() => null}>
            <boxGeometry args={[1.20, 0.82, 0.08]} />
          </mesh>
          {/* Dock platform / apron */}
          <mesh position={[w * 0.28, 0.83, d / 2 + 0.16]} material={accentMat} raycast={() => null}>
            <boxGeometry args={[1.40, 0.08, 0.24]} />
          </mesh>
          {/* Dock bumper strips */}
          <mesh position={[w * 0.28, 0.40, d / 2 + 0.10]} material={accentMat} raycast={() => null}>
            <boxGeometry args={[0.12, 0.72, 0.06]} />
          </mesh>
        </>
      )}

      {/* ── DEFAULT: simple mid-rise slab ─────────────────────────────────── */}
      {archetype === 'default' && (
        <>
          <mesh position={[0, height / 2, 0]} castShadow material={bodyMat}>
            <boxGeometry args={[w, height, d]} />
          </mesh>
          {beltsMain.map(by => (
            <mesh key={by} position={[0, by, 0]} material={accentMat} raycast={() => null}>
              <boxGeometry args={[w + BELT_OVERHANG, BELT_H, d + BELT_OVERHANG]} />
            </mesh>
          ))}
          <mesh position={[0, roofY + 0.07, 0]} castShadow material={roofMat} raycast={() => null}>
            <boxGeometry args={[w + 0.22, 0.14, d + 0.22]} />
          </mesh>
        </>
      )}

      {/* ── HVAC box on roof ──────────────────────────────────────────────── */}
      {showHVAC && (
        <mesh position={[roofW * 0.18, roofY + 0.22, roofD * 0.18]} material={hvacMat} raycast={() => null}>
          <boxGeometry args={[roofW * 0.30, 0.36, roofD * 0.30]} />
        </mesh>
      )}

      {/* ── Rooftop: water tower ──────────────────────────────────────────── */}
      {showWaterTower && (
        <group position={[roofDetails.waterTankSide * roofW * 0.28, roofY, 0]} raycast={() => null}>
          {[[-0.15,-0.14],[0.15,-0.14],[-0.15,0.14],[0.15,0.14]].map(([lx,lz],li) => (
            <mesh key={li} position={[lx, 0.24, lz]} material={antennaMat} raycast={() => null}>
              <boxGeometry args={[0.06, 0.48, 0.06]} />
            </mesh>
          ))}
          <mesh position={[0, 0.57, 0]} material={waterTankMat} raycast={() => null}>
            <boxGeometry args={[0.46, 0.40, 0.46]} />
          </mesh>
          <mesh position={[0, 0.79, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.52, 0.07, 0.52]} />
          </mesh>
        </group>
      )}

      {/* ── Rooftop: antenna ─────────────────────────────────────────────── */}
      {showAntenna && (
        <group position={[roofDetails.antennaX, roofY, roofD * 0.14]} raycast={() => null}>
          <mesh position={[0, roofDetails.antennaH / 2, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.06, roofDetails.antennaH, 0.06]} />
          </mesh>
          <mesh position={[0, roofDetails.antennaH, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.18, 0.05, 0.18]} />
          </mesh>
          <mesh position={[0, roofDetails.antennaH * 0.64, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.30, 0.04, 0.04]} />
          </mesh>
        </group>
      )}

      {/* ── Rooftop: garden ──────────────────────────────────────────────── */}
      {showRoofGarden && (
        <group position={[roofW * 0.10, roofY + 0.07, 0]} raycast={() => null}>
          <mesh position={[0, 0.06, 0]} material={gardenMats[roofDetails.gardenMatIdx]} raycast={() => null}>
            <boxGeometry args={[Math.min(roofW * 0.44, 2.2), 0.12, Math.min(roofD * 0.44, 2.2)]} />
          </mesh>
        </group>
      )}

      {/* ── Rooftop: satellite dish ───────────────────────────────────────── */}
      {showSatellite && (
        <group position={[-roofW * 0.22, roofY, roofD * 0.16]} raycast={() => null}>
          <mesh position={[0, 0.28, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.07, 0.56, 0.07]} />
          </mesh>
          <mesh position={[0, 0.54, 0.09]} rotation={[0.45, 0, 0]} material={antennaMat} raycast={() => null}>
            <boxGeometry args={[0.40, 0.40, 0.06]} />
          </mesh>
          <mesh position={[0, 0.56, 0.18]} material={accentMat} raycast={() => null}>
            <boxGeometry args={[0.08, 0.08, 0.07]} />
          </mesh>
        </group>
      )}

      {/* ── Door on south face (all except industrial which has loading dock) */}
      {archetype !== 'industrial' && (
        <mesh position={[0, doorH / 2, d / 2 + 0.04]} material={doorMat} raycast={() => null}>
          <boxGeometry args={[doorW, doorH, 0.06]} />
        </mesh>
      )}

      {/* ── Ambient windows (south + east face) ───────────────────────────── */}
      {windowData.map((wd, i) => (
        <mesh key={i} position={wd.pos} material={wd.mat} raycast={() => null}>
          <boxGeometry args={wd.args} />
        </mesh>
      ))}

      {/* ── Name label (when enabled) ─────────────────────────────────────── */}
      {showLabel && (
        <Text
          ref={labelRef}
          position={[0, roofY + 1.0, 0]}
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
