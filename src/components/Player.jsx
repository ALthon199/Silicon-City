import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayerStore } from '../store/playerStore'

const SPEED    = 9    // world-units per second — edit here and save to change
const BOB_AMP  = 0.10  // walk-bob amplitude in world units
const BOB_FREQ = 8.0   // bob oscillations per second

// Isometric movement axes for camera at [1,1,1] looking at [0,0,0]:
// W = screen-up   → world (-1, 0, -1) normalized
// S = screen-down → world (+1, 0, +1)
// A = screen-left → world (-1, 0, +1)
// D = screen-right→ world (+1, 0, -1)
const DIR = {
  w: new THREE.Vector3(-1, 0, -1).normalize(),
  s: new THREE.Vector3( 1, 0,  1).normalize(),
  a: new THREE.Vector3(-1, 0,  1).normalize(),
  d: new THREE.Vector3( 1, 0, -1).normalize(),
}

const keys  = { w: false, a: false, s: false, d: false }
const _move = new THREE.Vector3()  // reused every frame to avoid GC pressure

export default function Player() {
  const meshRef = useRef()
  const posRef = useRef(new THREE.Vector3(0, 0, 26))
  const setPosition = usePlayerStore(s => s.setPosition)

  useEffect(() => {
    function onKeyDown(e) {
      // Block movement when the terminal input (or any sidebar element) has focus
      if (document.activeElement?.closest('.sidebar')) return
      const k = e.key.toLowerCase()
      if (k in keys) keys[k] = true
    }
    function onKeyUp(e) {
      const k = e.key.toLowerCase()
      if (k in keys) keys[k] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useFrame((_, delta) => {
    // Consume teleport signal from store (written by cd transition)
    const storeState = usePlayerStore.getState()
    if (storeState.pendingTeleport) {
      const { x, z } = storeState.pendingTeleport
      posRef.current.set(x, 0, z)
      storeState.clearTeleport()
    }

    _move.set(0, 0, 0)
    if (keys.w) _move.add(DIR.w)
    if (keys.s) _move.add(DIR.s)
    if (keys.a) _move.add(DIR.a)
    if (keys.d) _move.add(DIR.d)

    if (_move.lengthSq() > 0) {
      _move.normalize().multiplyScalar(SPEED * delta)
      posRef.current.add(_move)
    }

    if (meshRef.current) {
      const isMoving = _move.lengthSq() > 0
      // Walk bob: gentle sine bounce while moving, smoothly settles to 0 at rest
      const bobY = isMoving
        ? Math.abs(Math.sin(performance.now() / 1000 * BOB_FREQ)) * BOB_AMP
        : 0
      meshRef.current.position.set(posRef.current.x, bobY, posRef.current.z)

      if (isMoving) {
        meshRef.current.rotation.y = Math.atan2(_move.x, _move.z)
      }
    }

    setPosition(posRef.current.x, posRef.current.z)
  })

  return (
    <group ref={meshRef} position={[0, 0, 0]}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.5, 0.8, 0.5]} />
        <meshStandardMaterial color="#ff4444" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[0.38, 0.38, 0.38]} />
        <meshStandardMaterial color="#ffcc88" roughness={0.5} />
      </mesh>
      {/* Shadow disc under feet */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 16]} />
        <meshBasicMaterial color="#00000033" transparent />
      </mesh>
    </group>
  )
}
