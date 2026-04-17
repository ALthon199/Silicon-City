/**
 * DustCloud — a brief brown-grey dust burst that spawns at a lot position
 * whenever a file or directory is deleted with `rm`.
 *
 * Lifetime: ~1.4 s  (fade in 180 ms → hold → fade out 180 ms)
 * Particles rise upward, spread outward, then fade.
 *
 * Props
 *   x, z  — lot centre position (world units)
 */
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SLAB_TOP   = 0.36

const TOTAL_MS   = 1400
const FADE_MS    = 180

const NDUST      = 10
const CYCLE      = 0.55   // seconds per particle cycle
const PUFF_VY    = 1.60   // upward speed (world-units/s)

const DUST_COLORS = ['#b89858', '#a88040', '#c8a860', '#907040', '#d0b870']

export default function DustCloud({ x, z }) {
  const birthMs  = useRef(performance.now())
  const dustRefs = useRef([])

  // Materials — created once, disposed on unmount
  const dustMats = useRef(
    Array.from({ length: NDUST }, (_, i) =>
      new THREE.MeshBasicMaterial({
        color: DUST_COLORS[i % DUST_COLORS.length],
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    )
  )

  // Per-particle: random outward burst direction + staggered phase
  const dustData = useMemo(() =>
    Array.from({ length: NDUST }, (_, i) => {
      const angle = (i / NDUST) * Math.PI * 2 + (Math.random() - 0.5) * 1.1
      const speed = 0.7 + Math.random() * 1.4
      return {
        dx:     Math.cos(angle) * speed,
        dz:     Math.sin(angle) * speed,
        phase0: i / NDUST,
      }
    }), [])

  useEffect(() => () => dustMats.current.forEach(m => m.dispose()), [])

  useFrame(() => {
    const elapsed = performance.now() - birthMs.current
    if (elapsed > TOTAL_MS) return

    // Overall envelope
    let env
    if (elapsed < FADE_MS) {
      env = elapsed / FADE_MS
    } else if (elapsed > TOTAL_MS - FADE_MS) {
      env = Math.max(0, (TOTAL_MS - elapsed) / FADE_MS)
    } else {
      env = 1
    }

    const t = elapsed / 1000
    for (let i = 0; i < NDUST; i++) {
      const mesh = dustRefs.current[i]
      if (!mesh) continue

      const { dx, dz, phase0 } = dustData[i]
      const phase = (t / CYCLE + phase0) % 1
      const life  = phase * CYCLE

      mesh.position.set(
        x + dx * life * 0.75,
        SLAB_TOP + PUFF_VY * life,
        z + dz * life * 0.75,
      )

      // Grow then shrink over each cycle
      const growScale = 0.08 + phase * 0.70
      mesh.scale.setScalar(growScale)

      // Fade in fast, hold, fade out
      const fade = phase < 0.25
        ? phase / 0.25
        : Math.max(0, 1.0 - (phase - 0.25) / 0.75)

      dustMats.current[i].opacity = fade * 0.72 * env
    }
  })

  return (
    <>
      {dustMats.current.map((mat, i) => (
        <mesh
          key={i}
          ref={el => { dustRefs.current[i] = el }}
          material={mat}
          scale={0}
        >
          <sphereGeometry args={[0.5, 5, 5]} />
        </mesh>
      ))}
    </>
  )
}
