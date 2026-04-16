import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayerStore } from '../store/playerStore'

const SPEED = 6

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

const keys = { w: false, a: false, s: false, d: false }

export default function Player() {
  const meshRef = useRef()
  const posRef = useRef(new THREE.Vector3(0, 0, 26))
  const setPosition = usePlayerStore(s => s.setPosition)

  useEffect(() => {
    function onKeyDown(e) {
      if (document.querySelector('.terminal-overlay')) return
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
    const move = new THREE.Vector3()
    if (keys.w) move.add(DIR.w)
    if (keys.s) move.add(DIR.s)
    if (keys.a) move.add(DIR.a)
    if (keys.d) move.add(DIR.d)

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(SPEED * delta)
      posRef.current.add(move)
    }

    if (meshRef.current) {
      meshRef.current.position.copy(posRef.current)

      // Rotate character to face movement direction (around Y axis)
      if (move.lengthSq() > 0) {
        const angle = Math.atan2(move.x, move.z)
        meshRef.current.rotation.y = angle
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
