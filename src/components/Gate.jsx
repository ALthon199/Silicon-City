/**
 * Gate — Roman Triumphal Arch for directory portals.
 *
 * Architecture (side-by-side with the perimeter wall at z = −30):
 *   ┌────────────────────────────────────────────────────────┐
 *   │  ┌──────┐  ╔══════════════════════════╗  ┌──────┐     │  ← Attic (1.25 tall)
 *   │  │      │  ║  SENATUS POPULUSQUE ...  ║  │      │     │
 *   │══╧══════╧══╩══════════════════════════╩══╧══════╧══│  ← Cornice / Entablature
 *   │  pier       ┌────────────────────────┐       pier  │
 *   │  ▐│▌        │  ╭────────────────╮   │        ▐│▌  │  ← Arch voussoirs (9 stones)
 *   │  ▐│▌        │  │  open air      │   │        ▐│▌  │  ← Piers + pilasters
 *   │  ▐│▌  [🏮] │  │                │  [🏮] ▐│▌  │  ← Optional torches (50%)
 *   │  ▐│▌  ████ │  │                │  ████ ▐│▌  │  ← Niche alcoves
 *   └──────────────────────────────────────────────────────┘
 *
 * Random variety per directory name:
 *   • Crown ornament — eagle / urn / trophy  (deterministic hash)
 *   • Banner colour  — red / gold / blue / purple
 *   • Torches        — 50 % chance
 *
 * Hover: arch voussoirs shimmer warm gold; keystone pulses.
 */
import { useRef, useState, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useVfsStore } from '../store/vfsStore'
import { usePlayerStore } from '../store/playerStore'
import PortalScene from './PortalScene'

// ── Deterministic hash (DJB2) ────────────────────────────────────────────────
function nameHash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

// ── Arch geometry ─────────────────────────────────────────────────────────────
const HW       = 1.50    // half-width of central opening  (opening = 3.0 wide)
const PIER_W   = 1.50    // width of each side pier
const PIER_CX  = HW + PIER_W / 2   // pier centre x  =  2.25
const FULL_W   = 2 * (HW + PIER_W) // total facade width  =  6.0
const PIER_D   = 1.40    // pier depth (front-to-back thickness)

const SPRING_Y = 5.00    // height to arch spring line (top of rectangular part)
const ARCH_R   = HW      // arch radius = half of opening width  =  1.5
const ARCH_TOP = SPRING_Y + ARCH_R  // = 6.5  —  apex of the crown

const ENT_Y    = ARCH_TOP            // entablature bottom
const ENT_H    = 1.20               // entablature total height
const ENT_TOP  = ENT_Y + ENT_H      // = 7.7

const ATTIC_Y   = ENT_TOP
const ATTIC_H   = 1.25
const ATTIC_TOP = ATTIC_Y + ATTIC_H // = 8.95  (base of crown ornament)

// Voussoir arch stones
const N_VOUS  = 9
const VOUS_W  = (Math.PI * ARCH_R / N_VOUS) * 1.14   // arc-length + 14 % overlap
const RADIAL_D = 0.42   // stone depth along the radius

// ── Colours ───────────────────────────────────────────────────────────────────
const STONE_C   = '#c8b89a'
const STONE_DK  = '#a89878'
const FRIEZE_C  = '#ddd4c0'
const CORNICE_C = '#b4a484'
const KEY_C     = '#e0d0a8'
const HOVER_C   = '#c09828'

const _baseColor = new THREE.Color(STONE_C)
const _hovColor  = new THREE.Color(HOVER_C)

// ── Shared (module-level) materials ──────────────────────────────────────────
const matStone    = new THREE.MeshLambertMaterial({ color: STONE_C })
const matStoneDk  = new THREE.MeshLambertMaterial({ color: STONE_DK })
const matFrieze   = new THREE.MeshLambertMaterial({ color: FRIEZE_C })
const matCornice  = new THREE.MeshLambertMaterial({ color: CORNICE_C })
const matKeystone = new THREE.MeshLambertMaterial({ color: KEY_C })

const BANNER_MATS = [
  new THREE.MeshLambertMaterial({ color: '#cc1111' }),
  new THREE.MeshLambertMaterial({ color: '#cc9900' }),
  new THREE.MeshLambertMaterial({ color: '#1133cc' }),
  new THREE.MeshLambertMaterial({ color: '#7711bb' }),
]

const matTorchGlow = new THREE.MeshBasicMaterial({ color: '#ffaa44' })
const matTorchPole = new THREE.MeshLambertMaterial({ color: '#5a3a1a' })

const noRay = () => null

// ── Crown ornament components ─────────────────────────────────────────────────
function CrownEagle() {
  return (
    <group>
      {/* Body */}
      <mesh position={[0, 0.28, 0]} material={matStoneDk} raycast={noRay}>
        <boxGeometry args={[0.44, 0.54, 0.38]} />
      </mesh>
      {/* Head */}
      <mesh position={[0.08, 0.73, 0.04]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
      </mesh>
      {/* Beak */}
      <mesh position={[0.27, 0.70, 0.04]} material={matStoneDk} raycast={noRay}>
        <boxGeometry args={[0.13, 0.08, 0.08]} />
      </mesh>
      {/* Left wing spread upward */}
      <mesh position={[-0.60, 0.44, 0]} rotation={[0, 0, 0.52]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.78, 0.17, 0.26]} />
      </mesh>
      {/* Right wing spread upward */}
      <mesh position={[ 0.60, 0.44, 0]} rotation={[0, 0, -0.52]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.78, 0.17, 0.26]} />
      </mesh>
      {/* Tail feathers */}
      <mesh position={[-0.18, 0.08, 0]} material={matStoneDk} raycast={noRay}>
        <boxGeometry args={[0.28, 0.28, 0.36]} />
      </mesh>
    </group>
  )
}

function CrownUrn() {
  return (
    <group>
      {/* Base plinth */}
      <mesh position={[0, 0.10, 0]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.52, 0.20, 0.38]} />
      </mesh>
      {/* Belly */}
      <mesh position={[0, 0.48, 0]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.58, 0.58, 0.44]} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 0.87, 0]} material={matStoneDk} raycast={noRay}>
        <boxGeometry args={[0.33, 0.23, 0.27]} />
      </mesh>
      {/* Rim */}
      <mesh position={[0, 1.02, 0]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.50, 0.12, 0.40]} />
      </mesh>
      {/* Scroll handles */}
      <mesh position={[-0.40, 0.48, 0]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.10, 0.46, 0.10]} />
      </mesh>
      <mesh position={[ 0.40, 0.48, 0]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.10, 0.46, 0.10]} />
      </mesh>
    </group>
  )
}

function CrownTrophy() {
  return (
    <group>
      {/* Wide base */}
      <mesh position={[0, 0.10, 0]} material={matStoneDk} raycast={noRay}>
        <boxGeometry args={[0.76, 0.20, 0.46]} />
      </mesh>
      {/* Middle block */}
      <mesh position={[0, 0.43, 0]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.46, 0.46, 0.33]} />
      </mesh>
      {/* Sphere-ish globe */}
      <mesh position={[0, 0.80, 0]} material={matKeystone} raycast={noRay}>
        <boxGeometry args={[0.33, 0.33, 0.33]} />
      </mesh>
      {/* Finial spike */}
      <mesh position={[0, 1.06, 0]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.10, 0.26, 0.10]} />
      </mesh>
    </group>
  )
}

const CROWN_KEYS = ['eagle', 'urn', 'trophy']
const CROWN_MAP  = { eagle: CrownEagle, urn: CrownUrn, trophy: CrownTrophy }

// ── Gate component ────────────────────────────────────────────────────────────
export default function Gate({ name, x, z, startDelay = 0 }) {
  const cd = useVfsStore(s => s.cd)

  const groupRef      = useRef()
  const keystoneRef   = useRef()
  const scaleProgress = useRef(0)
  const animDone      = useRef(false)
  const hoverProgress = useRef(0)
  const startAt       = useRef(performance.now() + startDelay)
  const [hovered, setHovered] = useState(false)

  // Deterministic variety — stable per directory name
  const variety = useMemo(() => {
    const h = nameHash(name)
    return {
      crownKey:   CROWN_KEYS[h % 3],
      bannerMat:  BANNER_MATS[(h >> 2) % 4],
      hasTorches: (h & 8) !== 0,
    }
  }, [name])

  // Per-instance hover-reactive material applied to arch voussoirs
  const archMat = useMemo(() => new THREE.MeshLambertMaterial({
    color: STONE_C,
    emissive: new THREE.Color(HOVER_C),
    emissiveIntensity: 0,
  }), [])

  // Voussoir positions — computed once, reused every render
  const voussoirs = useMemo(() => {
    const arr = []
    for (let i = 0; i < N_VOUS; i++) {
      const θ = Math.PI * (1 - (i + 0.5) / N_VOUS)
      arr.push({
        vx:   ARCH_R * Math.cos(θ),
        vy:   SPRING_Y + ARCH_R * Math.sin(θ),
        rz:   Math.PI / 2 + θ,
        isKey: i === ((N_VOUS - 1) >> 1),
        idx:  i,
      })
    }
    return arr
  }, [])

  useLayoutEffect(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(0)
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // ── Scale-in entrance (slower than buildings — feels weightier) ──────────
    if (!animDone.current) {
      if (performance.now() >= startAt.current) {
        scaleProgress.current = Math.min(1, scaleProgress.current + delta * 1.6)
        groupRef.current.scale.setScalar(scaleProgress.current)
        if (scaleProgress.current >= 1) animDone.current = true
      }
      return
    }

    // ── Early exit when idle ─────────────────────────────────────────────────
    if (!hovered && hoverProgress.current < 0.001) return

    // ── Smooth hover lerp ────────────────────────────────────────────────────
    const t  = performance.now() / 1000
    const lf = Math.min(1, delta * 8)
    hoverProgress.current = THREE.MathUtils.lerp(
      hoverProgress.current, hovered ? 1 : 0, lf,
    )
    const hp = hoverProgress.current

    archMat.emissiveIntensity = hp * 0.80
    archMat.color.lerpColors(_baseColor, _hovColor, hp * 0.35)

    // ── Keystone pulse ───────────────────────────────────────────────────────
    if (keystoneRef.current) {
      const pulse = hovered ? 1 + 0.12 * Math.sin(t * 4.0) : 1
      const ks = keystoneRef.current
      ks.scale.setScalar(
        THREE.MathUtils.lerp(ks.scale.x, pulse, Math.min(1, delta * 10)),
      )
    }
  })

  const CrownComp = CROWN_MAP[variety.crownKey]

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      onClick={e => {
        e.stopPropagation()
        usePlayerStore.getState().setCdTarget(x, z)
        cd(name)
      }}
      onPointerOver={e => { e.stopPropagation(); setHovered(true);  document.body.style.cursor = 'pointer' }}
      onPointerOut ={e => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'default' }}
    >

      {/* ═══════════════════════════════════════════════════════════════════
          PORTAL SCENE — night-city silhouette through the arch opening
          Renders at renderOrder=-1 so it always sits behind the stone.
          ═══════════════════════════════════════════════════════════════════ */}
      <PortalScene />

      {/* ═══════════════════════════════════════════════════════════════════
          PIERS — solid limestone blocks, same depth as perimeter wall
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[-PIER_CX, ARCH_TOP / 2, 0]} castShadow material={matStone} raycast={noRay}>
        <boxGeometry args={[PIER_W, ARCH_TOP, PIER_D]} />
      </mesh>
      <mesh position={[ PIER_CX, ARCH_TOP / 2, 0]} castShadow material={matStone} raycast={noRay}>
        <boxGeometry args={[PIER_W, ARCH_TOP, PIER_D]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          PIER DETAILS — niche alcoves + pilasters (engaged columns)
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Alcove niche — dark recessed panel on each pier front face */}
      <mesh position={[-PIER_CX, 2.50, PIER_D / 2 + 0.02]} material={matStoneDk} raycast={noRay}>
        <boxGeometry args={[0.72, 1.60, 0.07]} />
      </mesh>
      <mesh position={[ PIER_CX, 2.50, PIER_D / 2 + 0.02]} material={matStoneDk} raycast={noRay}>
        <boxGeometry args={[0.72, 1.60, 0.07]} />
      </mesh>
      {/* Niche arch crown suggestion */}
      <mesh position={[-PIER_CX, 3.38, PIER_D / 2 + 0.02]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.74, 0.16, 0.07]} />
      </mesh>
      <mesh position={[ PIER_CX, 3.38, PIER_D / 2 + 0.02]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.74, 0.16, 0.07]} />
      </mesh>

      {/* Pilasters — left pier (inner edge + outer edge) */}
      <mesh position={[-HW - 0.22, SPRING_Y * 0.48, PIER_D / 2 + 0.09]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.28, SPRING_Y * 0.94, 0.17]} />
      </mesh>
      <mesh position={[-HW - PIER_W + 0.22, SPRING_Y * 0.48, PIER_D / 2 + 0.09]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.28, SPRING_Y * 0.94, 0.17]} />
      </mesh>
      {/* Pilaster capitals — left pier */}
      <mesh position={[-HW - 0.22, SPRING_Y * 0.95 + 0.13, PIER_D / 2 + 0.09]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.40, 0.23, 0.22]} />
      </mesh>
      <mesh position={[-HW - PIER_W + 0.22, SPRING_Y * 0.95 + 0.13, PIER_D / 2 + 0.09]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.40, 0.23, 0.22]} />
      </mesh>

      {/* Pilasters — right pier */}
      <mesh position={[HW + 0.22, SPRING_Y * 0.48, PIER_D / 2 + 0.09]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.28, SPRING_Y * 0.94, 0.17]} />
      </mesh>
      <mesh position={[HW + PIER_W - 0.22, SPRING_Y * 0.48, PIER_D / 2 + 0.09]} material={matStone} raycast={noRay}>
        <boxGeometry args={[0.28, SPRING_Y * 0.94, 0.17]} />
      </mesh>
      {/* Pilaster capitals — right pier */}
      <mesh position={[HW + 0.22, SPRING_Y * 0.95 + 0.13, PIER_D / 2 + 0.09]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.40, 0.23, 0.22]} />
      </mesh>
      <mesh position={[HW + PIER_W - 0.22, SPRING_Y * 0.95 + 0.13, PIER_D / 2 + 0.09]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[0.40, 0.23, 0.22]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          ARCH VOUSSOIRS — 9 wedge-shaped stones arranged in a semicircle.
          The centre stone is the keystone (slightly lighter + hover-pulses).
          ═══════════════════════════════════════════════════════════════════ */}
      {voussoirs.map(({ vx, vy, rz, isKey, idx }) => (
        <mesh
          key={idx}
          ref={isKey ? keystoneRef : undefined}
          position={[vx, vy, 0]}
          rotation={[0, 0, rz]}
          material={isKey ? matKeystone : archMat}
          castShadow
          raycast={noRay}
        >
          <boxGeometry args={[VOUS_W, RADIAL_D, PIER_D + 0.08]} />
        </mesh>
      ))}

      {/* ═══════════════════════════════════════════════════════════════════
          ENTABLATURE — three-band classical frieze above the arch
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Architrave (bottom band) */}
      <mesh position={[0, ENT_Y + 0.14, 0]} castShadow material={matStone} raycast={noRay}>
        <boxGeometry args={[FULL_W, 0.28, PIER_D + 0.06]} />
      </mesh>
      {/* Frieze (inscription band — lighter colour, slightly wider) */}
      <mesh position={[0, ENT_Y + 0.57, 0]} material={matFrieze} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.10, 0.44, PIER_D + 0.02]} />
      </mesh>
      {/* Cornice (projecting top band) */}
      <mesh position={[0, ENT_Y + 0.97, 0]} castShadow material={matCornice} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.20, 0.30, PIER_D + 0.30]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          ATTIC STOREY — inscription panel + pier projections
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Main attic panel */}
      <mesh position={[0, ATTIC_Y + ATTIC_H / 2, 0]} castShadow material={matStone} raycast={noRay}>
        <boxGeometry args={[FULL_W - 0.04, ATTIC_H, PIER_D - 0.14]} />
      </mesh>
      {/* Attic base moulding */}
      <mesh position={[0, ATTIC_Y + 0.10, 0]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.12, 0.18, PIER_D + 0.06]} />
      </mesh>
      {/* Pier projections on attic face (align with main piers below) */}
      <mesh position={[-PIER_CX, ATTIC_Y + ATTIC_H / 2, PIER_D / 2 - 0.08 + 0.10]} material={matStone} raycast={noRay}>
        <boxGeometry args={[PIER_W * 0.68, ATTIC_H, 0.16]} />
      </mesh>
      <mesh position={[ PIER_CX, ATTIC_Y + ATTIC_H / 2, PIER_D / 2 - 0.08 + 0.10]} material={matStone} raycast={noRay}>
        <boxGeometry args={[PIER_W * 0.68, ATTIC_H, 0.16]} />
      </mesh>
      {/* Central inscription panel (lighter = legible) */}
      <mesh position={[0, ATTIC_Y + ATTIC_H / 2, PIER_D / 2 - 0.06 + 0.05]} material={matFrieze} raycast={noRay}>
        <boxGeometry args={[2.40, ATTIC_H * 0.66, 0.08]} />
      </mesh>
      {/* Attic top cap */}
      <mesh position={[0, ATTIC_TOP - 0.06, 0]} material={matCornice} raycast={noRay}>
        <boxGeometry args={[FULL_W, 0.12, PIER_D - 0.06]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          CROWN ORNAMENT — eagle / urn / trophy (varies per directory)
          ═══════════════════════════════════════════════════════════════════ */}
      <group position={[0, ATTIC_TOP, 0]}>
        <CrownComp />
      </group>

      {/* ═══════════════════════════════════════════════════════════════════
          BANNERS — coloured cloth hanging from entablature
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Left banner + horizontal rod */}
      <mesh
        position={[-FULL_W / 2 + 0.30, ENT_Y - 0.52, PIER_D / 2 + 0.08]}
        material={variety.bannerMat} raycast={noRay}
      >
        <boxGeometry args={[0.36, 1.04, 0.04]} />
      </mesh>
      <mesh
        position={[-FULL_W / 2 + 0.30, ENT_Y - 0.02, PIER_D / 2 + 0.08]}
        material={matStoneDk} raycast={noRay}
      >
        <boxGeometry args={[0.40, 0.07, 0.07]} />
      </mesh>
      {/* Right banner + rod */}
      <mesh
        position={[FULL_W / 2 - 0.30, ENT_Y - 0.52, PIER_D / 2 + 0.08]}
        material={variety.bannerMat} raycast={noRay}
      >
        <boxGeometry args={[0.36, 1.04, 0.04]} />
      </mesh>
      <mesh
        position={[FULL_W / 2 - 0.30, ENT_Y - 0.02, PIER_D / 2 + 0.08]}
        material={matStoneDk} raycast={noRay}
      >
        <boxGeometry args={[0.40, 0.07, 0.07]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          TORCHES — optional sconces (50 % chance, deterministic on name)
          ═══════════════════════════════════════════════════════════════════ */}
      {variety.hasTorches && (
        <>
          {/* Left torch */}
          <mesh position={[-1.80, 3.20, PIER_D / 2 + 0.24]} material={matTorchPole} raycast={noRay}>
            <boxGeometry args={[0.09, 0.80, 0.09]} />
          </mesh>
          <mesh position={[-1.80, 3.68, PIER_D / 2 + 0.24]} material={matTorchGlow} raycast={noRay}>
            <boxGeometry args={[0.20, 0.20, 0.20]} />
          </mesh>
          {/* Right torch */}
          <mesh position={[1.80, 3.20, PIER_D / 2 + 0.24]} material={matTorchPole} raycast={noRay}>
            <boxGeometry args={[0.09, 0.80, 0.09]} />
          </mesh>
          <mesh position={[1.80, 3.68, PIER_D / 2 + 0.24]} material={matTorchGlow} raycast={noRay}>
            <boxGeometry args={[0.20, 0.20, 0.20]} />
          </mesh>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          INVISIBLE CLICK TARGET — full height of the arch opening
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[0, SPRING_Y / 2, 0]} visible={false}>
        <boxGeometry args={[FULL_W, ARCH_TOP, 2.0]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          DIRECTORY LABEL — billboard above the crown
          ═══════════════════════════════════════════════════════════════════ */}
      <Text
        position={[0, ATTIC_TOP + 1.40, 0]}
        fontSize={0.44}
        color="#111111"
        outlineColor={hovered ? HOVER_C : STONE_C}
        outlineWidth={0.05}
        anchorX="center"
        anchorY="bottom"
        billboard
      >
        {`[ ${name} ]`}
      </Text>
    </group>
  )
}
