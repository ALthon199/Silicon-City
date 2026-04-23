/**
 * DustCloud — a multi-layer demolition burst at a lot position.
 *
 * Layers
 *   DUST  (14 large puffs)  — wide outward billow, slow rise, sandy/brown
 *   DEBRIS (12 chunks)      — fast outward arcs with gravity, concrete grey
 *   SMOKE  (10 plumes)      — tall rising column, dark grey
 *
 * Total lifetime: ~2 400 ms
 */
import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SLAB_TOP  = 0.36

const TOTAL_MS  = 2400
const FADE_MS   = 220

// ── Particle counts ──────────────────────────────────────────────────────────
const N_DUST   = 14
const N_DEBRIS = 12
const N_SMOKE  = 10
const N_TOTAL  = N_DUST + N_DEBRIS + N_SMOKE

// ── Per-type palette ─────────────────────────────────────────────────────────
const DUST_COLORS   = ['#c8a050', '#b08030', '#d4b060', '#a07030', '#ddc070']
const DEBRIS_COLORS = ['#808080', '#606060', '#9a9a9a', '#505050', '#707070']
const SMOKE_COLORS  = ['#404040', '#505050', '#383838', '#484848', '#303030']

function rng(min, max) { return min + Math.random() * (max - min) }

export default function DustCloud({ x, z }) {
  const birthMs  = useRef(performance.now())
  const meshRefs = useRef([])

  // One material per particle so each can have independent opacity
  const mats = useRef(
    Array.from({ length: N_TOTAL }, (_, i) => {
      let palette
      if      (i < N_DUST)             palette = DUST_COLORS
      else if (i < N_DUST + N_DEBRIS)  palette = DEBRIS_COLORS
      else                              palette = SMOKE_COLORS
      return new THREE.MeshBasicMaterial({
        color:       palette[i % palette.length],
        transparent: true,
        opacity:     0,
        depthWrite:  false,
      })
    })
  )

  // Per-particle constants, computed once
  const data = useMemo(() => {
    const arr = []

    // ── DUST puffs — big billowing spheres, wide spread, moderate rise ───────
    for (let i = 0; i < N_DUST; i++) {
      const angle = (i / N_DUST) * Math.PI * 2 + rng(-0.6, 0.6)
      const speed = rng(2.0, 5.0)
      arr.push({
        type:    'dust',
        dx:      Math.cos(angle) * speed,
        dz:      Math.sin(angle) * speed,
        vy:      rng(2.5, 5.0),
        size:    rng(1.0, 2.2),
        phase0:  i / N_DUST,
        cycle:   rng(0.55, 0.80),
      })
    }

    // ── DEBRIS chunks — fast lateral arcs with gravity ───────────────────────
    for (let i = 0; i < N_DEBRIS; i++) {
      const angle = rng(0, Math.PI * 2)
      const speed = rng(4.5, 9.0)
      arr.push({
        type:    'debris',
        dx:      Math.cos(angle) * speed,
        dz:      Math.sin(angle) * speed,
        vy:      rng(4.0, 8.0),     // initial vertical speed
        gravity: rng(8.0, 14.0),    // downward accel
        size:    rng(0.25, 0.55),
        phase0:  i / N_DEBRIS,
        cycle:   rng(0.45, 0.70),
      })
    }

    // ── SMOKE plumes — large, slow-rising, tight column ─────────────────────
    for (let i = 0; i < N_SMOKE; i++) {
      const angle = rng(0, Math.PI * 2)
      const spread = rng(0.3, 1.8)
      arr.push({
        type:    'smoke',
        dx:      Math.cos(angle) * spread,
        dz:      Math.sin(angle) * spread,
        vy:      rng(1.5, 3.5),
        size:    rng(1.4, 2.8),
        phase0:  i / N_SMOKE,
        cycle:   rng(0.70, 1.00),
      })
    }

    return arr
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => mats.current.forEach(m => m.dispose()), [])

  useFrame(() => {
    const elapsed = performance.now() - birthMs.current
    if (elapsed > TOTAL_MS) return

    // Global fade-in / fade-out envelope
    let env
    if (elapsed < FADE_MS) {
      env = elapsed / FADE_MS
    } else if (elapsed > TOTAL_MS - FADE_MS) {
      env = Math.max(0, (TOTAL_MS - elapsed) / FADE_MS)
    } else {
      env = 1
    }

    const t = elapsed / 1000   // seconds

    for (let i = 0; i < N_TOTAL; i++) {
      const mesh = meshRefs.current[i]
      if (!mesh) continue

      const d     = data[i]
      const phase = ((t / d.cycle) + d.phase0) % 1
      const life  = phase * d.cycle    // seconds into this particle's current cycle

      let px, py, pz, particleScale, fade

      if (d.type === 'debris') {
        // Ballistic arc: goes up then falls under gravity
        px = x  + d.dx * life
        pz = z  + d.dz * life
        py = SLAB_TOP + d.vy * life - 0.5 * d.gravity * life * life
        if (py < 0) py = 0

        particleScale = d.size * (0.5 + phase * 0.5)
        fade = phase < 0.2
          ? phase / 0.2
          : Math.max(0, 1 - (phase - 0.2) / 0.8)

      } else {
        // Dust / smoke: simple upward drift + outward spread
        px = x  + d.dx * life * 0.9
        pz = z  + d.dz * life * 0.9
        py = SLAB_TOP + d.vy * life

        particleScale = d.size * (0.12 + phase * 1.1)
        fade = phase < 0.20
          ? phase / 0.20
          : Math.max(0, 1 - (phase - 0.20) / 0.80)
      }

      mesh.position.set(px, py, pz)
      mesh.scale.setScalar(Math.max(0, 3*particleScale))
      mats.current[i].opacity = fade * 0.78 * env
    }
  })

  return (
    <>
      {mats.current.map((mat, i) => (
        <mesh
          key={i}
          ref={el => { meshRefs.current[i] = el }}
          material={mat}
          scale={0}
        >
          {data[i]?.type === 'debris'
            ? <boxGeometry    args={[0.5, 0.5, 0.5]} />
            : <sphereGeometry args={[0.5, 6, 6]} />
          }
        </mesh>
      ))}
    </>
  )
}
