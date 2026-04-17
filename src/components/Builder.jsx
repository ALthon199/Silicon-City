/**
 * Builder — a voxel construction worker who appears whenever a new
 * file (touch) or directory (mkdir) is created.
 *
 * He waits for the building/gate entrance animation to finish
 * (controlled by `spawnDelay` from CityScene), then pops in,
 * hammers enthusiastically, emits large billowing smoke puffs,
 * and fades back out after ~4.4 s.
 *
 * Props
 *   x, z        — lot centre position (world units)
 *   spawnDelay  — ms to wait before appearing (default 0)
 */
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SLAB_TOP = 0.36   // must match PlotGrid / CityBoundary constant

// ── Timing ────────────────────────────────────────────────────────────────────
const TOTAL_MS = 4400   // lifespan after spawn (must match CityScene BUILDER_TTL)
const FADE_MS  = 380    // scale-in / scale-out duration

// ── Smoke puff system ─────────────────────────────────────────────────────────
const NPUFFS     = 10
const PUFF_CYCLE = 2.4    // seconds for one puff to rise and fade out
const PUFF_VY    = 1.10   // upward speed (world-units/s)

// White-grey smoke colours — slight variation for billowy feel
const PUFF_COLORS = [
  '#f4f2f0', '#ede9e6', '#f0ece9', '#e8e4e2', '#f2eeec',
]

export default function Builder({ x, z, spawnDelay = 0 }) {
  const groupRef = useRef()
  const armRef   = useRef()
  // birthMs is the time the builder becomes active (after spawnDelay)
  const birthMs  = useRef(performance.now() + spawnDelay)

  // Puff mesh refs filled by callback refs in JSX
  const puffRefs = useRef([])

  // Puff materials — created once, disposed on unmount
  const puffMats = useRef(
    Array.from({ length: NPUFFS }, (_, i) =>
      new THREE.MeshBasicMaterial({
        color: PUFF_COLORS[i % PUFF_COLORS.length],
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    )
  )

  // Per-puff: random outward drift direction + staggered phase offset
  const puffData = useMemo(() =>
    Array.from({ length: NPUFFS }, (_, i) => {
      const angle = (i / NPUFFS) * Math.PI * 2 + (Math.random() - 0.5) * 1.2
      const speed = 0.30 + Math.random() * 0.55
      return {
        dx:     Math.cos(angle) * speed,
        dz:     Math.sin(angle) * speed,
        phase0: i / NPUFFS,   // evenly staggered → continuous emission
      }
    }), [])

  // Dispose puff materials on unmount to avoid GPU leak
  useEffect(() => () => puffMats.current.forEach(m => m.dispose()), [])

  useFrame(() => {
    const elapsed = performance.now() - birthMs.current

    // ── Still in spawn-delay period — keep everything hidden ──────────────
    if (elapsed < 0) {
      if (groupRef.current) groupRef.current.scale.setScalar(0)
      for (let i = 0; i < NPUFFS; i++) {
        if (puffMats.current[i]) puffMats.current[i].opacity = 0
      }
      return
    }

    if (!groupRef.current) return

    // ── Overall scale envelope: pop in → stay → pop out ───────────────────
    let scale
    if (elapsed < FADE_MS) {
      scale = elapsed / FADE_MS
    } else if (elapsed > TOTAL_MS - FADE_MS) {
      scale = Math.max(0, (TOTAL_MS - elapsed) / FADE_MS)
    } else {
      scale = 1
    }
    groupRef.current.scale.setScalar(scale)

    // ── Hammer swing ── abs(sin) gives fast strikes ────────────────────────
    if (armRef.current) {
      const t = elapsed / 1000
      armRef.current.rotation.x = -Math.abs(Math.sin(t * 5.8)) * 0.92
    }

    // ── Smoke puffs — world-space positions managed here ──────────────────
    const t     = elapsed / 1000
    const baseY = SLAB_TOP + 0.55   // emit from just above the slab

    for (let i = 0; i < NPUFFS; i++) {
      const mesh = puffRefs.current[i]
      if (!mesh) continue

      const { dx, dz, phase0 } = puffData[i]
      const phase = (t / PUFF_CYCLE + phase0) % 1   // 0 → 1 within cycle
      const life  = phase * PUFF_CYCLE               // seconds elapsed this cycle

      // Rise + slow horizontal drift
      mesh.position.set(
        x + dx * life * 0.55,
        baseY + PUFF_VY * life,
        z + dz * life * 0.55,
      )

      // Puff grows as it rises (small → large cloud)
      const growScale = 0.12 + phase * 1.38   // 0.12 → 1.5 over the cycle
      mesh.scale.setScalar(growScale)

      // Opacity: fade in fast (first 30 %), hold, then fade out slowly
      const fade = phase < 0.30
        ? phase / 0.30
        : Math.max(0, 1.0 - (phase - 0.30) / 0.70)

      puffMats.current[i].opacity = fade * 0.52 * scale
    }
  })

  // Builder stands at the front-right corner of the lot, facing the camera.
  // Camera is at [+28, +28, +28] → we rotate Math.PI * 1.25 so he faces the viewer.
  const bx = x + 1.4
  const bz = z + 1.4

  return (
    <>
      {/* ── Character group — scale envelope driven in useFrame ──────────── */}
      <group
        ref={groupRef}
        position={[bx, SLAB_TOP, bz]}
        rotation={[0, Math.PI * 1.25, 0]}
        scale={0}
      >
        {/* Boots / legs */}
        <mesh position={[-0.12, 0.15, 0]}>
          <boxGeometry args={[0.19, 0.30, 0.19]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh position={[ 0.12, 0.15, 0]}>
          <boxGeometry args={[0.19, 0.30, 0.19]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>

        {/* Body — orange hi-vis jacket */}
        <mesh position={[0, 0.64, 0]} castShadow>
          <boxGeometry args={[0.50, 0.70, 0.38]} />
          <meshStandardMaterial color="#e65100" />
        </mesh>

        {/* Reflective chest stripe */}
        <mesh position={[0, 0.60, 0.20]}>
          <boxGeometry args={[0.48, 0.09, 0.02]} />
          <meshStandardMaterial color="#ffee00" emissive="#ffee00" emissiveIntensity={0.55} />
        </mesh>

        {/* Head */}
        <mesh position={[0, 1.21, 0]} castShadow>
          <boxGeometry args={[0.35, 0.35, 0.35]} />
          <meshStandardMaterial color="#f5c27a" />
        </mesh>

        {/* Hard-hat brim */}
        <mesh position={[0, 1.46, 0]}>
          <boxGeometry args={[0.48, 0.08, 0.48]} />
          <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.28} />
        </mesh>
        {/* Hard-hat dome */}
        <mesh position={[0, 1.57, 0]}>
          <boxGeometry args={[0.35, 0.15, 0.35]} />
          <meshStandardMaterial color="#ffcc00" emissive="#ffcc00" emissiveIntensity={0.28} />
        </mesh>

        {/* ── Hammer arm — pivots at right shoulder ── */}
        <group ref={armRef} position={[0.30, 0.94, 0]}>
          <mesh position={[0.06, -0.14, 0]}>
            <boxGeometry args={[0.13, 0.28, 0.13]} />
            <meshStandardMaterial color="#f5c27a" />
          </mesh>
          <mesh position={[0.06, -0.34, 0]}>
            <boxGeometry args={[0.08, 0.20, 0.08]} />
            <meshStandardMaterial color="#7b4f1a" />
          </mesh>
          <mesh position={[0.06, -0.49, 0]}>
            <boxGeometry args={[0.26, 0.13, 0.12]} />
            <meshStandardMaterial color="#888" roughness={0.25} metalness={0.75} />
          </mesh>
        </group>

        {/* Left arm — hangs at side */}
        <mesh position={[-0.31, 0.82, 0]}>
          <boxGeometry args={[0.13, 0.36, 0.13]} />
          <meshStandardMaterial color="#f5c27a" />
        </mesh>
      </group>

      {/* ── Smoke puff meshes — world-space positions driven in useFrame ─── */}
      {puffMats.current.map((mat, i) => (
        <mesh
          key={i}
          ref={el => { puffRefs.current[i] = el }}
          material={mat}
          scale={0}
        >
          {/* Sphere gives a round cloud silhouette; 6×6 segments is low-poly but fine */}
          <sphereGeometry args={[0.50, 6, 6]} />
        </mesh>
      ))}
    </>
  )
}
