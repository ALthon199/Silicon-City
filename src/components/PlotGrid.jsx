/**
 * PlotGrid — renders 60 raised concrete building lot slabs using instanced meshes.
 *
 * Each lot is an 8×8 platform raised above the asphalt base.
 * Curb strips run along all four edges to give a distinct raised-curb look.
 * The 4 park lots are rendered separately by CityBoundary with green material.
 * Total: 3 draw calls for all 60 lots.
 */
import { useMemo } from 'react'
import { Instances, Instance } from '@react-three/drei'
import * as THREE from 'three'
import { LOT_SIZE } from '../engine/gridLayout'

const SLAB_H   = 0.28    // height of the raised slab
const SLAB_Y   = 0.08 + SLAB_H / 2  // sits on top of the asphalt base (y=0.08)

const CURB_H   = 0.10    // curb strip height (sits on top of slab)
const CURB_W   = 0.25    // curb strip width
const CURB_Y   = SLAB_Y + SLAB_H / 2 + CURB_H / 2

// Slab geometry & material
const slabGeo = new THREE.BoxGeometry(LOT_SIZE, SLAB_H, LOT_SIZE)
const slabMat = new THREE.MeshLambertMaterial({ color: '#d2c8b4' })

// Curb strips: E-W (along x axis) and N-S (along z axis)
const curbEWGeo = new THREE.BoxGeometry(LOT_SIZE, CURB_H, CURB_W)
const curbNSGeo = new THREE.BoxGeometry(CURB_W, CURB_H, LOT_SIZE)
const curbMat   = new THREE.MeshLambertMaterial({ color: '#a89e8e' })

const HALF_LOT = LOT_SIZE / 2

export default function PlotGrid({ positions }) {
  // Precompute curb positions for each lot:
  // North edge, South edge (E-W curbs) and East edge, West edge (N-S curbs)
  const ewCurbs = useMemo(() => {
    const out = []
    for (const { x, z } of positions) {
      out.push([x, z - HALF_LOT + CURB_W / 2])  // south edge
      out.push([x, z + HALF_LOT - CURB_W / 2])  // north edge
    }
    return out
  }, [positions])

  const nsCurbs = useMemo(() => {
    const out = []
    for (const { x, z } of positions) {
      out.push([x - HALF_LOT + CURB_W / 2, z])  // west edge
      out.push([x + HALF_LOT - CURB_W / 2, z])  // east edge
    }
    return out
  }, [positions])

  return (
    <>
      {/* Slab bases — 1 draw call */}
      <Instances geometry={slabGeo} material={slabMat} limit={64}>
        {positions.map(({ x, z }, i) => (
          <Instance key={i} position={[x, SLAB_Y, z]} />
        ))}
      </Instances>

      {/* E-W curb strips (N/S edges of each slab) — 1 draw call */}
      <Instances geometry={curbEWGeo} material={curbMat} limit={128}>
        {ewCurbs.map(([x, z], i) => (
          <Instance key={i} position={[x, CURB_Y, z]} />
        ))}
      </Instances>

      {/* N-S curb strips (E/W edges of each slab) — 1 draw call */}
      <Instances geometry={curbNSGeo} material={curbMat} limit={128}>
        {nsCurbs.map(([x, z], i) => (
          <Instance key={i} position={[x, CURB_Y, z]} />
        ))}
      </Instances>
    </>
  )
}
