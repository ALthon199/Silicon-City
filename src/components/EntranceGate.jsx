/**
 * EntranceGate — Modern grand archway at the city entrance (z = +CITY_HALF).
 *
 * Same concrete + steel design as Gate.jsx, distinguished by:
 *   • Warm gold steel instead of neutral grey — grand entrance palette.
 *   • No scale-in animation (always at full scale — the entrance never disappears).
 *   • Dimmed to grey when already at root (cd '..') would be a no-op.
 *   • Click: cd('..') + setCdTarget.
 *   • Beacon crown light on top.
 *
 * Geometry constants kept in sync with Gate.jsx:
 *   FULL_W = 6.0, PIER_D = 1.40, SPRING_Y = 5.0, ARCH_TOP = 6.5
 */
import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useVfsStore } from '../store/vfsStore'
import { usePlayerStore } from '../store/playerStore'
import PortalScene from './PortalScene'

// ── Arch geometry (identical to Gate.jsx) ────────────────────────────────────
const HW       = 1.50
const PIER_W   = 1.50
const PIER_CX  = HW + PIER_W / 2      // = 2.25
const FULL_W   = 2 * (HW + PIER_W)    // = 6.0
const PIER_D   = 1.40
const PIER_H   = 5.00                  // = SPRING_Y

const SPRING_Y = PIER_H
const ARCH_R   = HW                    // = 1.5
const ARCH_TOP = SPRING_Y + ARCH_R     // = 6.5

const BEAM_H   = 0.40
const N_SEG    = 7
const ARC_STEP = (Math.PI * ARCH_R) / N_SEG
const SEG_W    = ARC_STEP * 1.12
const SEG_H    = 0.30
const SEG_D    = PIER_D * 0.80

// ── Grand entrance palette — warm gold ───────────────────────────────────────
const GOLD_STEEL  = '#c8a040'
const GOLD_DIM    = '#a88030'
const CONCRETE_C  = '#454550'
const BASE_C      = '#505058'
const SIGN_C      = '#18181e'
const ROOT_C      = '#686460'     // dimmed grey when at root

const _goldColor  = new THREE.Color(GOLD_STEEL)
const _rootColor  = new THREE.Color(ROOT_C)

const matConcrete = new THREE.MeshLambertMaterial({ color: CONCRETE_C })
const matBase     = new THREE.MeshLambertMaterial({ color: BASE_C })
const matSign     = new THREE.MeshLambertMaterial({ color: SIGN_C })
const matBeacon   = new THREE.MeshBasicMaterial({ color: '#ffdd88', transparent: true, opacity: 0.9 })

const noRay = () => null

export default function EntranceGate({ x, z }) {
  const cd  = useVfsStore(s => s.cd)
  const cwd = useVfsStore(s => s.cwd)

  const hoverProgress = useRef(0)
  const [hovered, setHovered] = useState(false)
  const atRoot = cwd === '/'

  // Per-instance steel material — colour lerps to grey at root
  const matSteel = useMemo(() => new THREE.MeshLambertMaterial({
    color:   GOLD_STEEL,
    emissive: new THREE.Color(GOLD_STEEL),
    emissiveIntensity: 0.10,
  }), [])

  const matLED = useMemo(() => new THREE.MeshBasicMaterial({
    color: GOLD_STEEL,
    transparent: true,
    opacity: 0.75,
  }), [])

  // Arch segments (same math as Gate.jsx)
  const archSegs = useMemo(() => {
    const segs = []
    for (let i = 0; i < N_SEG; i++) {
      const θ = Math.PI * (i + 0.5) / N_SEG
      segs.push({
        px: ARCH_R * Math.cos(θ),
        py: SPRING_Y + ARCH_R * Math.sin(θ),
        rz: θ + Math.PI / 2,
      })
    }
    return segs
  }, [])

  useFrame((_, delta) => {
    const lf = Math.min(1, delta * 8)
    const t  = performance.now() / 1000

    if (atRoot) {
      // Fade to dim grey at root
      hoverProgress.current = THREE.MathUtils.lerp(hoverProgress.current, 0, lf)
      matSteel.color.lerp(_rootColor, lf * 0.15)
      matSteel.emissiveIntensity = THREE.MathUtils.lerp(matSteel.emissiveIntensity, 0, lf)
      matLED.opacity = THREE.MathUtils.lerp(matLED.opacity, 0.20, lf)
      return
    }

    // Restore gold if we navigated back from root
    matSteel.color.lerp(_goldColor, lf * 0.10)

    hoverProgress.current = THREE.MathUtils.lerp(
      hoverProgress.current, hovered ? 1 : 0, lf,
    )
    const hp = hoverProgress.current

    matSteel.emissiveIntensity = 0.10 + hp * 0.45
    matLED.opacity = hovered
      ? 0.75 + 0.25 * Math.sin(t * 3.0)
      : THREE.MathUtils.lerp(matLED.opacity, 0.55, lf)
  })

  const labelText  = atRoot ? '/ (root)' : '← Back'
  const labelColor = atRoot ? ROOT_C : GOLD_STEEL

  return (
    <group
      position={[x, 0, z]}
      onClick={e => {
        e.stopPropagation()
        if (!atRoot) {
          usePlayerStore.getState().setCdTarget(x, z)
          cd('..')
        }
      }}
      onPointerOver={e => {
        e.stopPropagation()
        if (!atRoot) { setHovered(true); document.body.style.cursor = 'pointer' }
      }}
      onPointerOut={e => {
        e.stopPropagation()
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
    >
      {/* ── Portal (night-city silhouette) ────────────────────────────────── */}
      <PortalScene />

      {/* ── Invisible click target (keeps hover/click on the full arch area) */}
      <mesh position={[0, SPRING_Y / 2, 0]} visible={false}>
        <boxGeometry args={[FULL_W, ARCH_TOP, 2.0]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* ── Grand base plinth (wider than regular gates) ──────────────────── */}
      <mesh position={[0, 0.14, 0]} castShadow material={matBase} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.40, 0.28, PIER_D + 0.50]} />
      </mesh>

      {/* ── Left pier ─────────────────────────────────────────────────────── */}
      <mesh position={[-PIER_CX, PIER_H / 2, 0]} castShadow material={matConcrete} raycast={noRay}>
        <boxGeometry args={[PIER_W, PIER_H, PIER_D]} />
      </mesh>
      <mesh position={[-HW - 0.10, PIER_H * 0.46, PIER_D / 2 + 0.01]} material={matBase} raycast={noRay}>
        <boxGeometry args={[0.10, PIER_H * 0.88, 0.04]} />
      </mesh>

      {/* ── Right pier ────────────────────────────────────────────────────── */}
      <mesh position={[ PIER_CX, PIER_H / 2, 0]} castShadow material={matConcrete} raycast={noRay}>
        <boxGeometry args={[PIER_W, PIER_H, PIER_D]} />
      </mesh>
      <mesh position={[ HW + 0.10, PIER_H * 0.46, PIER_D / 2 + 0.01]} material={matBase} raycast={noRay}>
        <boxGeometry args={[0.10, PIER_H * 0.88, 0.04]} />
      </mesh>

      {/* ── Golden header beam ────────────────────────────────────────────── */}
      <mesh position={[0, BEAM_H / 2 + SPRING_Y, 0]} castShadow material={matSteel} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.14, BEAM_H, PIER_D + 0.08]} />
      </mesh>

      {/* ── "← Back" sign on front face of header ─────────────────────────── */}
      <mesh position={[0, BEAM_H / 2 + SPRING_Y, PIER_D / 2 + 0.05]} material={matSign} raycast={noRay}>
        <boxGeometry args={[2.80, 0.28, 0.06]} />
      </mesh>
      <mesh position={[0, BEAM_H * 0.88 + SPRING_Y, PIER_D / 2 + 0.06]} material={matLED} raycast={noRay}>
        <boxGeometry args={[2.80, 0.05, 0.04]} />
      </mesh>
      <Text
        position={[0, BEAM_H / 2 + SPRING_Y, PIER_D / 2 + 0.09]}
        fontSize={0.22}
        color={atRoot ? ROOT_C : '#f0e8c8'}
        anchorX="center"
        anchorY="middle"
        billboard={false}
        raycast={noRay}
      >
        {labelText}
      </Text>

      {/* ── Gold steel arch (7 segments) ─────────────────────────────────── */}
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

      {/* ── Gold LED strip on inner arch face ─────────────────────────────── */}
      {archSegs.map(({ px, py, rz }, i) => (
        <mesh
          key={i}
          position={[px, py, SEG_D / 2 + 0.02]}
          rotation={[0, 0, rz]}
          material={matLED}
          raycast={noRay}
        >
          <boxGeometry args={[SEG_W * 0.92, 0.08, 0.04]} />
        </mesh>
      ))}

      {/* ── Crown cap + beacon light at apex ─────────────────────────────── */}
      <mesh position={[0, ARCH_TOP + 0.10, 0]} castShadow material={matSteel} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.14, 0.18, PIER_D + 0.08]} />
      </mesh>
      {/* Beacon pedestal */}
      <mesh position={[0, ARCH_TOP + 0.30, 0]} material={matConcrete} raycast={noRay}>
        <boxGeometry args={[0.40, 0.20, 0.40]} />
      </mesh>
      {/* Beacon light */}
      <mesh position={[0, ARCH_TOP + 0.55, 0]} material={matBeacon} raycast={noRay}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
      </mesh>

      {/* ── Gold corner accent lights on pier tops ─────────────────────────── */}
      {[-PIER_CX, PIER_CX].map((px, i) => (
        <mesh key={i} position={[px, PIER_H + 0.07, 0]} material={matLED} raycast={noRay}>
          <boxGeometry args={[PIER_W + 0.04, 0.12, PIER_D + 0.04]} />
        </mesh>
      ))}

      {/* ── Billboard label above arch (state-reactive) ───────────────────── */}
      <Text
        position={[0, ARCH_TOP + 1.10, 0]}
        fontSize={0.44}
        color={labelColor}
        outlineColor="#111111"
        outlineWidth={0.05}
        anchorX="center"
        anchorY="bottom"
        billboard
      >
        {labelText}
      </Text>
    </group>
  )
}
