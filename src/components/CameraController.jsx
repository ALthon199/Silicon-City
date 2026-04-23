import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { usePlayerStore } from '../store/playerStore'
import * as THREE from 'three'

const ISO_DIST    = 28
const DEFAULT_ZOOM = 12
const MIN_ZOOM    = 12
const MAX_ZOOM    = 38.5
const ZOOM_SPEED  = 0.012

// Lerp rates (per-frame, at ~60 fps)
const ZOOM_LERP_NORMAL     = 0.12   // smooth scroll-wheel response
const ZOOM_LERP_TRANSITION = 0.11   // quick dramatic zoom-in toward arch
const PAN_LERP_NORMAL      = 0.22   // responsive player follow
const PAN_LERP_TRANSITION  = 0.07   // pan during transition

// How far (0–1) to drift toward the gate during a transition.
const GATE_BLEND = 0.40

export default function CameraController() {
  const { camera } = useThree()
  const zoomRef         = useRef(DEFAULT_ZOOM)
  const wasInTransition = useRef(false)

  // Smooth camera target — start at city centre so the first frame looks
  // into the city, not toward the entrance where the ground edge is visible.
  const smoothX = useRef(0)
  const smoothZ = useRef(0)

  useEffect(() => {
    function onWheel(e) {
      if (e.target.closest?.('.sidebar')) return
      zoomRef.current = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomRef.current - e.deltaY * ZOOM_SPEED)
      )
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  useFrame(() => {
    const { x, z, cdTarget, cdZoom } = usePlayerStore.getState()

    const inTransition = cdTarget !== null

    // Transition just ended → snap camera and zoom to clean starting state
    // so the new city district always comes in centered at the same zoom level.
    // Snap to city centre (0, 0) — not spawn (which is at the entrance edge
    // where the bottom frustum would show the green ground beyond the front wall).
    if (wasInTransition.current && !inTransition) {
      smoothX.current   = 0
      smoothZ.current   = 0
      zoomRef.current   = DEFAULT_ZOOM
      camera.zoom       = DEFAULT_ZOOM
      camera.updateProjectionMatrix()
    }
    wasInTransition.current = inTransition

    // During a transition drift the camera toward the gate so the arch moves
    // toward screen-centre.  Outside a transition, track the player exactly.
    const destX = inTransition ? x + (cdTarget.x - x) * GATE_BLEND : x
    const destZ = inTransition ? z + (cdTarget.z - z) * GATE_BLEND : z

    const panRate = inTransition ? PAN_LERP_TRANSITION : PAN_LERP_NORMAL
    smoothX.current = THREE.MathUtils.lerp(smoothX.current, destX, panRate)
    smoothZ.current = THREE.MathUtils.lerp(smoothZ.current, destZ, panRate)

    camera.position.set(
      smoothX.current + ISO_DIST,
      ISO_DIST,
      smoothZ.current + ISO_DIST,
    )
    camera.lookAt(smoothX.current, 0, smoothZ.current)

    if (camera.isOrthographicCamera) {
      const targetZoom = cdZoom !== null ? cdZoom : zoomRef.current
      const zoomRate   = inTransition ? ZOOM_LERP_TRANSITION : ZOOM_LERP_NORMAL
      camera.zoom += (targetZoom - camera.zoom) * zoomRate
      camera.updateProjectionMatrix()
    }
  })

  return null
}
