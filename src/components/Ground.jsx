import * as THREE from 'three'

/**
 * Ground — flat grass plane.
 *
 * The secondary plane at Y=-100 is a catch-all for the orthographic camera.
 * When fully zoomed out the isometric frustum's bottom edge dips below Y=0,
 * so some camera rays start under the main plane and travel further downward,
 * missing all geometry. Without the catch-all those pixels show the raw
 * canvas background as a visible green stripe.  The deep plane (DoubleSide,
 * 6000×6000) intercepts every such ray regardless of viewport size or player
 * position, and since it shares the same colour as the canvas background the
 * result is seamless at any zoom level.
 */
export default function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} raycast={() => null}>
        <planeGeometry args={[1000, 1000]} />
        <meshBasicMaterial color="#5a9e30" />
      </mesh>

      {/* Catch-all for orthographic rays that dip below the main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -100, 0]} raycast={() => null}>
        <planeGeometry args={[6000, 6000]} />
        <meshBasicMaterial color="#5a9e30" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
