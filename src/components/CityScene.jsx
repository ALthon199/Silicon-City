import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { useVfsStore } from '../store/vfsStore'
import { cityLayout, ENTRANCE_POS, FILE_SLOTS } from '../engine/gridLayout'
import Ground from './Ground'
import PlotGrid from './PlotGrid'
import Building from './Building'
import Gate from './Gate'
import EntranceGate from './EntranceGate'
import CityBoundary from './CityBoundary'
import Player from './Player'
import CameraController from './CameraController'

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
  const tree = useVfsStore(s => s.tree)
  const cwd  = useVfsStore(s => s.cwd)

  const { fileSlots, dirSlots } = useMemo(() => {
    const cwdNode = getNodeAtPath(tree, cwd)
    return cityLayout(cwdNode?.children ?? [])
  }, [tree, cwd])

  const plotPositions = useMemo(() => FILE_SLOTS, [])

  return (
    <group>
      <Ground />
      <CityBoundary />

      <PlotGrid positions={plotPositions} />

      {fileSlots.map(({ x, z, node }) =>
        node ? (
          <Building
            key={node.name}
            name={node.name}
            ext={node.ext}
            size={node.size}
            x={x}
            z={z}
            showLabel={showLabels}
          />
        ) : null
      )}

      {dirSlots.map(({ x, z, node }) =>
        node ? (
          <Gate key={node.name} name={node.name} x={x} z={z} />
        ) : null
      )}

      <EntranceGate x={ENTRANCE_POS.x} z={ENTRANCE_POS.z} />

      <Player />
    </group>
  )
}

export default function CityScene({ showLabels }) {
  return (
    <Canvas
      orthographic
      shadows
      camera={{ zoom: 13, position: [28, 28, 28], near: 0.1, far: 2000 }}
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* Background matches grass color — no blue sky ever visible */}
      <color attach="background" args={['#5a9e30']} />

      <ambientLight intensity={0.75} color="#fff8f0" />
      <directionalLight
        position={[40, 70, 30]}
        intensity={1.8}
        color="#fff5e0"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-camera-near={1}
        shadow-camera-far={220}
      />
      <directionalLight position={[-20, 10, -20]} intensity={0.35} color="#c8e8ff" />

      <CameraController />
      <City showLabels={showLabels} />
    </Canvas>
  )
}
