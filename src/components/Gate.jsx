/**
 * Gate — modern concrete + steel archway for directory portals.
 *
 * Architecture (side view, looking from +Z toward gate at z=−30):
 *
 *        ╭──────── steel arch (7 box segments) ────────╮
 *       ╱                                               ╲   ← ARCH_TOP y=6.5
 *      │   ╔═══════ LED strip (emissive) ══════════╗   │
 *      │   ║                                       ║   │
 *   pier   ║     [  directory name sign  ]        ║   pier
 *   ████ ══╩═══════════════════════════════════════╩═══ ████   ← header beam y=5.0
 *   ████                                               ████
 *   ████           portal scene (night sky)            ████
 *   ████                                               ████
 *   ████████████████████████████████████████████████████████   ← base plinth y=0
 *
 * Geometry constants match Gate.jsx ↔ EntranceGate.jsx ↔ CityBoundary.
 *   FULL_W = 6.0  (total facade width = 2×PIER_W + opening 3.0)
 *   PIER_D = 1.40
 *
 * Hover: LED strip pulses brighter, arch beam emissive rises.
 * Click: setCdTarget + cd(name).
 */
import { useRef, useState, useLayoutEffect, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useVfsStore } from '../store/vfsStore'
import { usePlayerStore } from '../store/playerStore'
import PortalScene from './PortalScene'

// ── Deterministic hash (DJB2) ─────────────────────────────────────────────────
function nameHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

// ── Arch geometry (kept in sync with EntranceGate.jsx) ───────────────────────
const HW       = 1.50   // half opening width  →  opening = 3.0
const PIER_W   = 1.50   // width of each pier
const PIER_CX  = HW + PIER_W / 2   // pier centre x = 2.25
const FULL_W   = 2 * (HW + PIER_W) // total facade width = 6.0
const PIER_D   = 1.40   // pier depth (front-to-back)
const PIER_H   = 5.00   // pier height (= SPRING_Y)

// Arch (semicircle) sits on top of piers
const SPRING_Y = PIER_H          // y where arch begins = 5.0
const ARCH_R   = HW              // arch radius = 1.5
const ARCH_TOP = SPRING_Y + ARCH_R   // crown apex y = 6.5

// Header beam connecting pier tops just below the arch spring
const BEAM_Y   = SPRING_Y        // beam centre y = 5.0
const BEAM_H   = 0.38

// 7-segment steel arch approximation
const N_SEG    = 7
const ARC_STEP = (Math.PI * ARCH_R) / N_SEG     // arc length per segment ≈ 0.673
const SEG_W    = ARC_STEP * 1.12                 // slight overlap to avoid gaps ≈ 0.754
const SEG_H    = 0.30                            // radial thickness of arch beam
const SEG_D    = PIER_D * 0.80                   // depth (slightly shallower than piers)

// ── LED accent colours (deterministic per directory name) ─────────────────────
const LED_COLORS = ['#4488ff', '#22ccaa', '#ff9944', '#44cc66']

// ── Module-level shared materials ─────────────────────────────────────────────
// Concrete piers — shared across all gates (same colour)
const matConcrete = new THREE.MeshLambertMaterial({ color: '#454550' })
const matBase     = new THREE.MeshLambertMaterial({ color: '#505058' })
const matSign     = new THREE.MeshLambertMaterial({ color: '#18181e' })

// Steel arch + header — will have emissiveIntensity modulated on hover
// Per-instance material created in the component to isolate hover effects.

const noRay = () => null

const DEMOLISH_MS = 1200  // must be < TerminalHUD rm delay (1400 ms)

export default function Gate({ name, x, z, startDelay = 0, demolishing = false }) {
  const cd = useVfsStore(s => s.cd)

  const groupRef      = useRef()
  const scaleProgress = useRef(0)
  const animDone      = useRef(false)
  const hoverProgress = useRef(0)
  const startAt       = useRef(performance.now() + startDelay)
  const demolishAt    = useRef(null)
  const [hovered, setHovered] = useState(false)

  // Deterministic variety — unique LED colour per directory name
  const variety = useMemo(() => {
    const h = nameHash(name)
    return {
      ledColor:    LED_COLORS[h % LED_COLORS.length],
      signColor:   LED_COLORS[(h + 1) % LED_COLORS.length],  // slightly different tint for sign
    }
  }, [name])

  // Per-instance materials (isolated hover effects)
  const matSteel = useMemo(() => new THREE.MeshLambertMaterial({
    color: '#606870',
    emissive: new THREE.Color('#224466'),
    emissiveIntensity: 0,
  }), [])

  const matLED = useMemo(() => new THREE.MeshBasicMaterial({
    color: variety.ledColor,
    transparent: true,
    opacity: 0.85,
  }), [variety.ledColor])

  // Arch segment positions (7 segments along semicircle, computed once)
  const archSegs = useMemo(() => {
    const segs = []
    for (let i = 0; i < N_SEG; i++) {
      const θ = Math.PI * (i + 0.5) / N_SEG
      segs.push({
        px:  ARCH_R * Math.cos(θ),
        py:  SPRING_Y + ARCH_R * Math.sin(θ),
        rz:  θ + Math.PI / 2,  // tangent orientation → box aligns with arc
      })
    }
    return segs
  }, [])

  useLayoutEffect(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(0)
  }, [])

  useEffect(() => {
    if (demolishing && demolishAt.current === null) {
      demolishAt.current = performance.now()
    }
  }, [demolishing])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Demolish shrink-out (cubic ease-in: slow start → fast collapse)
    if (demolishAt.current !== null) {
      const t = Math.min(1, (performance.now() - demolishAt.current) / DEMOLISH_MS)
      groupRef.current.scale.setScalar(Math.max(0, 1 - t * t * t))
      return
    }

    // Scale-in entrance
    if (!animDone.current) {
      if (performance.now() >= startAt.current) {
        scaleProgress.current = Math.min(1, scaleProgress.current + delta * 1.6)
        groupRef.current.scale.setScalar(scaleProgress.current)
        if (scaleProgress.current >= 1) animDone.current = true
      }
      return
    }

    if (!hovered && hoverProgress.current < 0.001) return

    const lf = Math.min(1, delta * 8)
    hoverProgress.current = THREE.MathUtils.lerp(hoverProgress.current, hovered ? 1 : 0, lf)
    const hp = hoverProgress.current

    // Steel arch brightens on hover
    matSteel.emissiveIntensity = hp * 0.55

    // LED strip opacity pulses
    if (matLED) {
      const t = performance.now() / 1000
      matLED.opacity = hovered
        ? 0.80 + 0.20 * Math.sin(t * 3.5)
        : THREE.MathUtils.lerp(matLED.opacity, 0.55, lf)
    }
  })

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      onClick={e => {
        e.stopPropagation()
        usePlayerStore.getState().setCdTarget(x, z)
        cd(name)
      }}
      onPointerOver={e => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={e => {
        e.stopPropagation()
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
    >
      {/* ── Portal (night-city silhouette through the opening) ─────────────── */}
      <PortalScene />

      {/* ── Ground base plinth ────────────────────────────────────────────── */}
      {/* Connects both piers at grade, extends slightly wider + deeper */}
      <mesh position={[0, 0.14, 0]} castShadow material={matBase} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.20, 0.28, PIER_D + 0.30]} />
      </mesh>

      {/* ── Left concrete pier ────────────────────────────────────────────── */}
      <mesh position={[-PIER_CX, PIER_H / 2, 0]} castShadow material={matConcrete} raycast={noRay}>
        <boxGeometry args={[PIER_W, PIER_H, PIER_D]} />
      </mesh>
      {/* Pier reveal: thin vertical recess on inner face (visual depth) */}
      <mesh position={[-HW - 0.10, PIER_H * 0.46, PIER_D / 2 + 0.01]} material={matBase} raycast={noRay}>
        <boxGeometry args={[0.10, PIER_H * 0.88, 0.04]} />
      </mesh>

      {/* ── Right concrete pier ───────────────────────────────────────────── */}
      <mesh position={[ PIER_CX, PIER_H / 2, 0]} castShadow material={matConcrete} raycast={noRay}>
        <boxGeometry args={[PIER_W, PIER_H, PIER_D]} />
      </mesh>
      <mesh position={[ HW + 0.10, PIER_H * 0.46, PIER_D / 2 + 0.01]} material={matBase} raycast={noRay}>
        <boxGeometry args={[0.10, PIER_H * 0.88, 0.04]} />
      </mesh>

      {/* ── Header beam (horizontal, connects pier tops) ──────────────────── */}
      <mesh position={[0, BEAM_Y + BEAM_H / 2, 0]} castShadow material={matSteel} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.14, BEAM_H, PIER_D + 0.08]} />
      </mesh>

      {/* ── Directory name sign on front face of header beam ─────────────── */}
      <mesh position={[0, BEAM_Y + BEAM_H / 2, PIER_D / 2 + 0.05]} material={matSign} raycast={noRay}>
        <boxGeometry args={[2.60, 0.28, 0.06]} />
      </mesh>
      {/* Coloured accent strip above sign */}
      <mesh position={[0, BEAM_Y + BEAM_H * 0.88, PIER_D / 2 + 0.06]} material={matLED} raycast={noRay}>
        <boxGeometry args={[2.60, 0.05, 0.04]} />
      </mesh>
      <Text
        position={[0, BEAM_Y + BEAM_H / 2, PIER_D / 2 + 0.09]}
        fontSize={0.21}
        color="#e8e8f0"
        anchorX="center"
        anchorY="middle"
        billboard={false}
        raycast={noRay}
      >
        {name}
      </Text>

      {/* ── Steel arch (7 box segments approximating a semicircle) ─────────── */}
      {archSegs.map(({ px, py, rz }, i) => (
        <mesh
          key={i}
          position={[px, py, 0]}
          rotation={[0, 0, rz]}
          castShadow
          material={matSteel}
          raycast={noRay}
        >
          <boxGeometry args={[SEG_W, SEG_H, SEG_D]} />
        </mesh>
      ))}

      {/* ── LED strip — inner face of arch (emissive glow) ────────────────── */}
      {archSegs.map(({ px, py, rz }, i) => (
        <mesh
          key={i}
          position={[px, py, SEG_D / 2 + 0.02]}
          rotation={[0, 0, rz]}
          material={matLED}
          raycast={noRay}
        >
          {/* Thin strip: same width as arch segment, very thin */}
          <boxGeometry args={[SEG_W * 0.92, 0.08, 0.04]} />
        </mesh>
      ))}

      {/* ── Arch crown cap (flat slab at top, ties arch ends together) ─────── */}
      <mesh position={[0, ARCH_TOP + 0.08, 0]} castShadow material={matSteel} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.14, 0.16, PIER_D + 0.08]} />
      </mesh>

      {/* ── Corner accent lights on pier tops ─────────────────────────────── */}
      {[-PIER_CX, PIER_CX].map((px, i) => (
        <mesh key={i} position={[px, PIER_H + 0.06, 0]} material={matLED} raycast={noRay}>
          <boxGeometry args={[PIER_W + 0.04, 0.10, PIER_D + 0.04]} />
        </mesh>
      ))}
    </group>
  )
}
