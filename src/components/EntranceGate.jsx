/**
 * EntranceGate — "back to parent" archway embedded in the front wall.
 *
 * No scale-in animation — it is always visible at full scale.
 * (The scale animation was the source of the "fading" bug: R3F reconciles
 *  the scale prop on every re-render triggered by cwd changes, resetting
 *  the group to scale=0 after animDone was already true.)
 *
 * Material is stable (never recreated). Color/emissive are mutated via
 * useEffect so hover changes don't cause a GPU material swap flicker.
 */
import { useState, useEffect, useMemo } from 'react'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useVfsStore } from '../store/vfsStore'
import { WALL_H, GATE_OPEN_W, GATE_PILLAR } from '../engine/gridLayout'

const PILLAR_H  = WALL_H + 0.9
const OPENING_H = 3.2
const LINTEL_H  = WALL_H - OPENING_H
const FRAME_T   = 0.13

const GATE_COLOR = '#58504a'   // dark iron — same as dir gates
const GATE_HOV   = '#c07828'   // warm amber hover glow
const ROOT_COLOR = '#48403c'   // dimmer when at root

const stoneMat    = new THREE.MeshLambertMaterial({ color: '#b8aca0' })
const capMat      = new THREE.MeshLambertMaterial({ color: '#c8b8a8' })
const keystoneMat = new THREE.MeshLambertMaterial({ color: '#9a8880' })

export default function EntranceGate({ x, z }) {
  const cd  = useVfsStore(s => s.cd)
  const cwd = useVfsStore(s => s.cwd)

  const [hovered, setHovered] = useState(false)
  const atRoot = cwd === '/'

  // One stable material — mutated on hover / atRoot change, never recreated
  const frameMat = useMemo(() => new THREE.MeshLambertMaterial({ color: GATE_COLOR }), [])

  useEffect(() => {
    const c = atRoot ? ROOT_COLOR : hovered ? GATE_HOV : GATE_COLOR
    frameMat.color.setStyle(c)
    const glowing = hovered && !atRoot
    frameMat.emissive.setStyle(glowing ? '#c07828' : '#000000')
    frameMat.emissive.multiplyScalar(glowing ? 0.4 : 0)
  }, [hovered, atRoot, frameMat])

  const hw       = GATE_OPEN_W / 2
  const pillarCx = hw + GATE_PILLAR / 2
  const frameColor = atRoot ? ROOT_COLOR : hovered ? GATE_HOV : GATE_COLOR

  return (
    <group
      position={[x, 0, z]}
      onClick={e => { e.stopPropagation(); if (!atRoot) cd('..') }}
      onPointerOver={e => { e.stopPropagation(); if (!atRoot) { setHovered(true); document.body.style.cursor = 'pointer' } }}
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
        outlineColor={frameColor}
        outlineWidth={0.05}
        anchorX="center"
        anchorY="bottom"
        billboard
      >
        {atRoot ? '/ (root)' : '← Back'}
      </Text>
    </group>
  )
}
