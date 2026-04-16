/**
 * Ground — simple flat grass plane.
 * The drei Grid component is removed: it z-fights with road meshes from
 * CityBoundary. The actual road grid comes from those explicit meshes.
 */
export default function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} raycast={() => null}>
      <planeGeometry args={[1000, 1000]} />
      <meshLambertMaterial color="#5a9e30" />
    </mesh>
  )
}
