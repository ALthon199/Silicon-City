/**
 * Gate — directory archway embedded in the city's back wall.
 *
 * Scale-in animation is driven imperatively via useLayoutEffect + useFrame
 * so that React reconciliation never resets the scale mid-animation.
 */
import { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useVfsStore } from '../store/vfsStore'
import { WALL_H, GATE_OPEN_W, GATE_PILLAR } from '../engine/gridLayout'

const PILLAR_H  = WALL_H + 0.9
const OPENING_H = 3.2
const LINTEL_H  = WALL_H - OPENING_H
const FRAME_T   = 0.13

const GATE_COLOR = '#58504a'   // dark wrought-iron
const GATE_HOV   = '#c07828'   // warm amber on hover

const stoneMat    = new THREE.MeshLambertMaterial({ color: '#b8aca0' })
const capMat      = new THREE.MeshLambertMaterial({ color: '#c8b8a8' })
const keystoneMat = new THREE.MeshLambertMaterial({ color: '#9a8880' })

export default function Gate({ name, x, z }) {
  const cd = useVfsStore(s => s.cd)
  const groupRef      = useRef()
  const scaleProgress = useRef(0)
  const animDone      = useRef(false)
  const [hovered, setHovered] = useState(false)

  // One stable material instance — mutated on hover, never recreated
  const frameMat = useMemo(() => new THREE.MeshLambertMaterial({ color: GATE_COLOR }), [])

  // Set initial scale to 0 imperatively so React reconciliation never resets it
  useLayoutEffect(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(0)
  }, [])

  // Mutate material color + emissive on hover change
  useEffect(() => {
    frameMat.color.setStyle(hovered ? GATE_HOV : GATE_COLOR)
    frameMat.emissive.setStyle(hovered ? '#c07828' : '#000000')
    frameMat.emissive.multiplyScalar(hovered ? 0.4 : 0)
  }, [hovered, frameMat])

  useFrame((_, delta) => {
    if (animDone.current || !groupRef.current) return
    scaleProgress.current = Math.min(1, scaleProgress.current + delta * 2)
    groupRef.current.scale.setScalar(scaleProgress.current)
    if (scaleProgress.current >= 1) animDone.current = true
  })

  const hw       = GATE_OPEN_W / 2
  const pillarCx = hw + GATE_PILLAR / 2

  return (
    <group
      ref={groupRef}
      position={[x, 0, z]}
      onClick={e => { e.stopPropagation(); cd(name) }}
      onPointerOver={e => { e.stopPropagation(); setHovered(true);  document.body.style.cursor = 'pointer' }}
      onPointerOut ={e => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'default' }}
    >
      {/* Left pillar */}
      <mesh position={[-pillarCx, PILLAR_H / 2, 0]} castShadow material={stoneMat}>
        <boxGeometry args={[GATE_PILLAR, PILLAR_H, GATE_PILLAR]} />
      </mesh>
      <mesh position={[-pillarCx, PILLAR_H + 0.25, 0]} material={capMat}>
        <boxGeometry args={[GATE_PILLAR + 0.25, 0.5, GATE_PILLAR + 0.25]} />
      </mesh>

      {/* Right pillar */}
      <mesh position={[pillarCx, PILLAR_H / 2, 0]} castShadow material={stoneMat}>
        <boxGeometry args={[GATE_PILLAR, PILLAR_H, GATE_PILLAR]} />
      </mesh>
      <mesh position={[pillarCx, PILLAR_H + 0.25, 0]} material={capMat}>
        <boxGeometry args={[GATE_PILLAR + 0.25, 0.5, GATE_PILLAR + 0.25]} />
      </mesh>

      {/* Stone lintel above opening */}
      <mesh position={[0, OPENING_H + LINTEL_H / 2, 0]} castShadow material={stoneMat}>
        <boxGeometry args={[GATE_OPEN_W + GATE_PILLAR * 2, LINTEL_H, GATE_PILLAR]} />
      </mesh>

      {/* Keystone accent */}
      <mesh position={[0, OPENING_H + 0.18, 0]} material={keystoneMat}>
        <boxGeometry args={[0.55, 0.36, 0.55]} />
      </mesh>

      {/* Iron arch frame — left, right, top */}
      <mesh position={[-(hw - FRAME_T / 2), OPENING_H / 2, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, OPENING_H, FRAME_T]} />
      </mesh>
      <mesh position={[hw - FRAME_T / 2, OPENING_H / 2, 0]} material={frameMat}>
        <boxGeometry args={[FRAME_T, OPENING_H, FRAME_T]} />
      </mesh>
      <mesh position={[0, OPENING_H - FRAME_T / 2, 0]} material={frameMat}>
        <boxGeometry args={[GATE_OPEN_W, FRAME_T, FRAME_T]} />
      </mesh>

      {/* Invisible click target */}
      <mesh position={[0, OPENING_H / 2, 0]} visible={false}>
        <boxGeometry args={[GATE_OPEN_W, OPENING_H, 1.2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <Text
        position={[0, PILLAR_H + 1.1, 0]}
        fontSize={0.44}
        color="#111111"
        outlineColor={hovered ? GATE_HOV : GATE_COLOR}
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
