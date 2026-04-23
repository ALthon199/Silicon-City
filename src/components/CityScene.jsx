import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import gsap from 'gsap'
import { useVfsStore } from '../store/vfsStore'
import { usePlayerStore, SPAWN_X, SPAWN_Z } from '../store/playerStore'
import { cityLayout, ENTRANCE_POS, FILE_SLOTS } from '../engine/gridLayout'
import Ground from './Ground'
import PlotGrid from './PlotGrid'
import Building from './Building'
import Gate from './Gate'
import EntranceGate from './EntranceGate'
import CityBoundary from './CityBoundary'
import CityBorder   from './CityBorder'
import Player from './Player'
import CameraController from './CameraController'
import Builder    from './Builder'
import DustCloud  from './DustCloud'
import Citizen from './Citizen'

const BUILDER_TTL = 4400  // ms lifespan — must match Builder.jsx TOTAL_MS
const DUST_TTL    = 2400  // ms — must match DustCloud.jsx TOTAL_MS

function getNodeAtPath(tree, path) {
  if (path === '/') return tree
  const parts = path.split('/').filter(Boolean)
  let node = tree
  for (const part of parts) {
    if (node.type !== 'dir') return null
    const child = node.children.find(c => c.name === part)
    if (!child) return null
    node = child
  }
  return node
}

function City({ showLabels }) {
  const tree        = useVfsStore(s => s.tree)
  const cwd         = useVfsStore(s => s.cwd)
  const loadVersion = useVfsStore(s => s.loadVersion)

  // displayedCwd lags behind real cwd — only updates after exit animation completes
  const [displayedCwd, setDisplayedCwd] = useState(() => cwd)
  const buildingsGroupRef = useRef()
  const tweenRef          = useRef(null)
  const prevCwd           = useRef(cwd)

  useEffect(() => {
    if (cwd === prevCwd.current) return
    const newCwd = cwd
    prevCwd.current = newCwd

    // Kill any in-progress exit tween
    if (tweenRef.current) tweenRef.current.kill()

    const finish = () => {
      usePlayerStore.getState().clearCdTarget()   // release camera zoom/pan lock
      usePlayerStore.getState().teleportTo(SPAWN_X, SPAWN_Z)
      setDisplayedCwd(newCwd)
      tweenRef.current = null
    }

    const group   = buildingsGroupRef.current
    const targets = group ? [...group.children].map(c => c.scale) : []

    if (targets.length === 0) {
      finish()
      return
    }

    // Staggered scale-out, then a brief hold so the camera reaches peak zoom
    // before the scene switches.  Timeline fires finish() only at the very end.
    const tl = gsap.timeline({ onComplete: finish })
    tl.to(targets, {
      x: 0, y: 0, z: 0,
      duration: 0.16,
      stagger: 0.012,
      ease: 'back.in(1.4)',
    })
    // Brief hold — scene is clear, then switch
    tl.to({}, { duration: 0.12 })
    tweenRef.current = tl
  }, [cwd])

  const { fileSlots, dirSlots } = useMemo(() => {
    const cwdNode = getNodeAtPath(tree, displayedCwd)
    return cityLayout(cwdNode?.children ?? [])
  }, [tree, displayedCwd])

  // Only filled slots, used for staggered startDelay on entry
  const filledFiles = useMemo(() => fileSlots.filter(s => s.node), [fileSlots])
  const filledDirs  = useMemo(() => dirSlots.filter(s => s.node),  [dirSlots])

  const plotPositions = useMemo(() => FILE_SLOTS, [])

  // ── Builder / demolition system ─────────────────────────────────────────
  // knownKeys: Map<"cwd§name", {x, z}> — tracks which nodes we've seen
  // so we can detect both additions (→ Builder) and removals (→ DustCloud).
  const [activeBuilders,   setActiveBuilders]   = useState([])
  const [activeDustClouds, setActiveDustClouds] = useState([])
  // Set of "cwd§name" keys currently mid-demolition (building shrinks before VFS rm)
  const [demolishingKeys,  setDemolishingKeys]  = useState(() => new Set())
  const knownKeys          = useRef(new Map())
  const firstRender        = useRef(true)
  const prevBuilderCwd     = useRef(displayedCwd)
  const prevLoadVersionRef = useRef(loadVersion)
  // Keys for which we already spawned a pre-demolition DustCloud so the normal
  // removal-detection loop can skip spawning a duplicate.
  const pendingRemovals = useRef(new Set())

  // ── Synchronous load-reset (must happen BEFORE justCreatedKeys useMemo) ──
  // justCreatedKeys runs during render; a useEffect would fire too late.
  // Mutating refs in the render body is safe: refs don't cause re-renders and
  // the check is idempotent (guarded by prevLoadVersionRef).
  if (prevLoadVersionRef.current !== loadVersion) {
    prevLoadVersionRef.current = loadVersion
    firstRender.current        = true
    knownKeys.current          = new Map()
    pendingRemovals.current    = new Set()
  }

  // ── Detect newly-created nodes synchronously during render ───────────────
  // knownKeys.current is intentionally stale here (useEffect hasn't run yet),
  // so any key absent from it in the current filledFiles/filledDirs is brand-new.
  // These buildings get startDelay = BUILDER_TTL so they only appear once the
  // builder and smoke are gone.
  const justCreatedKeys = useMemo(() => {
    // On first mount all nodes are "existing"; same after a cd switch or load.
    if (firstRender.current || prevBuilderCwd.current !== displayedCwd) return new Set()
    const s = new Set()
    for (const { node } of filledFiles) {
      if (node && !knownKeys.current.has(`${displayedCwd}§${node.name}`)) {
        s.add(`${displayedCwd}§${node.name}`)
      }
    }
    for (const { node } of filledDirs) {
      if (node && !knownKeys.current.has(`${displayedCwd}§${node.name}`)) {
        s.add(`${displayedCwd}§${node.name}`)
      }
    }
    return s
  }, [filledFiles, filledDirs, displayedCwd])

  // ── Clean up React state after a repo load ───────────────────────────────
  // Refs are already reset synchronously above; this effect handles the
  // React state (builders / dust / demolishing) which can't be set mid-render.
  useEffect(() => {
    if (loadVersion === 0) return
    setActiveBuilders([])
    setActiveDustClouds([])
    setDemolishingKeys(new Set())
  }, [loadVersion])

  // Listen for the terminal's pre-demolition signal.
  // Starts the DustCloud and the building shrink-animation before VFS removal.
  useEffect(() => {
    const handler = e => {
      const { name } = e.detail
      const key = `${displayedCwd}§${name}`
      const pos = knownKeys.current.get(key)
      if (!pos) return

      // Mark as mid-demolition so Building/Gate can start shrinking
      pendingRemovals.current.add(key)
      setDemolishingKeys(prev => new Set([...prev, key]))

      // Spawn DustCloud immediately (building still visible)
      const dustId = `pre-dust-${key}¬${Date.now()}`
      setActiveDustClouds(prev => [...prev, { id: dustId, ...pos }])
      setTimeout(
        () => setActiveDustClouds(prev => prev.filter(p => p.id !== dustId)),
        DUST_TTL,
      )
    }
    window.addEventListener('vfs-pre-remove', handler)
    return () => window.removeEventListener('vfs-pre-remove', handler)
  }, [displayedCwd])

  useEffect(() => {
    const sameCwd = prevBuilderCwd.current === displayedCwd

    // First mount: populate knownKeys without spawning anything
    if (firstRender.current) {
      firstRender.current = false
      const init = new Map()
      filledFiles.forEach(({ x, z, node }) => node && init.set(`${displayedCwd}§${node.name}`, { x, z }))
      filledDirs.forEach(({ x, z, node })  => node && init.set(`${displayedCwd}§${node.name}`, { x, z }))
      knownKeys.current = init
      prevBuilderCwd.current = displayedCwd
      return
    }

    // After a cd navigation: reset tracking for the new directory — no spawns
    if (!sameCwd) {
      prevBuilderCwd.current = displayedCwd
      const reset = new Map()
      filledFiles.forEach(({ x, z, node }) => node && reset.set(`${displayedCwd}§${node.name}`, { x, z }))
      filledDirs.forEach(({ x, z, node })  => node && reset.set(`${displayedCwd}§${node.name}`, { x, z }))
      knownKeys.current = reset
      return
    }

    // Same cwd: compute next map, diff against known to find additions + removals
    const next   = new Map()
    const spawns = []

    filledFiles.forEach(({ x, z, node }) => {
      if (!node) return
      const key = `${displayedCwd}§${node.name}`
      next.set(key, { x, z })
      // Builder spawns immediately (spawnDelay: 0); building waits for it to finish
      if (!knownKeys.current.has(key)) spawns.push({ id: `${key}¬${Date.now()}`, x, z })
    })
    filledDirs.forEach(({ x, z, node }) => {
      if (!node) return
      const key = `${displayedCwd}§${node.name}`
      next.set(key, { x, z })
      if (!knownKeys.current.has(key)) spawns.push({ id: `${key}¬${Date.now()}`, x, z })
    })

    // Detect removals (nodes that disappeared since last render)
    const demolitions = []
    for (const [key, pos] of knownKeys.current) {
      if (!next.has(key)) {
        if (pendingRemovals.current.has(key)) {
          // DustCloud already started by the pre-remove event — skip duplicate
          pendingRemovals.current.delete(key)
          setDemolishingKeys(prev => { const s = new Set(prev); s.delete(key); return s })
        } else {
          demolitions.push({ id: `dust-${key}¬${Date.now()}`, ...pos })
        }
      }
    }

    knownKeys.current = next

    if (spawns.length > 0) {
      setActiveBuilders(prev => [...prev, ...spawns])
      spawns.forEach(b =>
        setTimeout(
          () => setActiveBuilders(prev => prev.filter(p => p.id !== b.id)),
          BUILDER_TTL,
        )
      )
    }

    if (demolitions.length > 0) {
      setActiveDustClouds(prev => [...prev, ...demolitions])
      demolitions.forEach(d =>
        setTimeout(
          () => setActiveDustClouds(prev => prev.filter(p => p.id !== d.id)),
          DUST_TTL,
        )
      )
    }
  }, [filledFiles, filledDirs, displayedCwd])

  return (
    <group>
      <Ground />
      <CityBoundary />
      <CityBorder />
      <PlotGrid positions={plotPositions} />
      <Citizen />
      {/* Buildings and gates — grouped so GSAP can tween their scales on exit */}
      <group ref={buildingsGroupRef}>
        {filledFiles.map(({ x, z, node }, i) => {
          const key        = `${displayedCwd}§${node.name}`
          const startDelay = justCreatedKeys.has(key) ? BUILDER_TTL : i * 45
          return (
            <Building
              key={`${displayedCwd}:${node.name}`}
              name={node.name}
              ext={node.ext}
              size={node.size}
              x={x}
              z={z}
              showLabel={showLabels}
              startDelay={startDelay}
              demolishing={demolishingKeys.has(key)}
            />
          )
        })}
        {filledDirs.map(({ x, z, node }, i) => {
          const key        = `${displayedCwd}§${node.name}`
          const startDelay = justCreatedKeys.has(key) ? BUILDER_TTL : (filledFiles.length + i) * 45
          return (
            <Gate
              key={`${displayedCwd}:${node.name}`}
              name={node.name}
              x={x}
              z={z}
              startDelay={startDelay}
              demolishing={demolishingKeys.has(key)}
            />
          )
        })}
      </group>

      <EntranceGate x={ENTRANCE_POS.x} z={ENTRANCE_POS.z} />
      <Player />

      {/* Construction builders — appear immediately; buildings wait for them to finish */}
      {activeBuilders.map(b => (
        <Builder key={b.id} x={b.x} z={b.z} />
      ))}

      {/* Demolition dust — brief dust burst when rm removes a node */}
      {activeDustClouds.map(d => (
        <DustCloud key={d.id} x={d.x} z={d.z} />
      ))}
    </group>
  )
}

export default function CityScene() {
  return (
    <Canvas
      orthographic
      shadows
      camera={{ zoom: 13, position: [28, 28, 28], near: 0.1, far: 2000 }}
      gl={{ powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Background matches grass color — no blue sky ever visible */}
      <color attach="background" args={['#5a9e30']} />

      <ambientLight intensity={0.75} color="#fff8f0" />
      <directionalLight
        position={[60, 100, 60]}
        intensity={1.8}
        color="#fff5e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-camera-near={1}
        shadow-camera-far={220}
      />
      <directionalLight position={[-20, 10, -20]} intensity={0.35} color="#c8e8ff" />

      <CameraController />
      <City showLabels={false} />
    </Canvas>
  )
}
