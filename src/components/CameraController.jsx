import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { usePlayerStore } from '../store/playerStore'
import * as THREE from 'three'

const ISO_DIST    = 28
const DEFAULT_ZOOM = 13
const MIN_ZOOM    = 11    // hard floor — prevents seeing past the ground edges
const MAX_ZOOM    = 38
const ZOOM_SPEED  = 0.012 // 100 * 0.012 = 1.2 zoom units per scroll tick

export default function CameraController() {
  const { camera } = useThree()
  const zoomRef = useRef(DEFAULT_ZOOM)
  const target  = useRef(new THREE.Vector3())

  useEffect(() => {
    function onWheel(e) {
      if (document.querySelector('.terminal-overlay')) return
      zoomRef.current = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomRef.current - e.deltaY * ZOOM_SPEED)
      )
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  useFrame(() => {
    const { x, z } = usePlayerStore.getState()
    target.current.set(x, 0, z)

    camera.position.set(
      target.current.x + ISO_DIST,
      target.current.y + ISO_DIST,
      target.current.z + ISO_DIST
    )
    camera.lookAt(target.current)

    if (camera.isOrthographicCamera) {
      camera.zoom += (zoomRef.current - camera.zoom) * 0.12
      camera.updateProjectionMatrix()
    }
  })

  return null
}
