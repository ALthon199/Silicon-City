/**
 * EntranceGate — Imperial Roman Triumphal Arch at the city entrance (z = +CITY_HALF).
 *
 * Architecturally identical to Gate.jsx (same HW / PIER_W / voussoir ring),
 * but distinguished by:
 *   • Imperial gold / cream palette instead of plain limestone.
 *   • Always-on eagle crown, crimson+gold banners, and torches — no random variety.
 *   • No scale-in animation — always at full scale.
 *   • Click navigates to parent directory (cd '..'); dimmed at root.
 *   • Portal scene (night-city silhouette) visible through the arch opening.
 *
 * Surface features are on the +z face (same as Gate.jsx) because the isometric
 * camera at [ISO+px, ISO, ISO+pz] views the +z side of both the back gates
 * (at z=−30) and the entrance gate (at z=+30) due to the diagonal view direction.
 */
import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { useVfsStore } from '../store/vfsStore'
import { usePlayerStore } from '../store/playerStore'
import PortalScene from './PortalScene'

// ── Arch geometry (identical to Gate.jsx) ────────────────────────────────────
const HW       = 1.50
const PIER_W   = 1.50
const PIER_CX  = HW + PIER_W / 2     // = 2.25
const FULL_W   = 2 * (HW + PIER_W)   // = 6.0
const PIER_D   = 1.40

const SPRING_Y = 5.00
const ARCH_R   = HW                   // = 1.5
const ARCH_TOP = SPRING_Y + ARCH_R    // = 6.5

const ENT_Y    = ARCH_TOP
const ENT_H    = 1.20
const ENT_TOP  = ENT_Y + ENT_H       // = 7.7

const ATTIC_Y   = ENT_TOP
const ATTIC_H   = 1.25
const ATTIC_TOP = ATTIC_Y + ATTIC_H  // = 8.95

const N_VOUS   = 9
const VOUS_W   = (Math.PI * ARCH_R / N_VOUS) * 1.14
const RADIAL_D = 0.42

// ── Imperial colour palette ───────────────────────────────────────────────────
const STONE_C  = '#d4c4a8'   // warmer / lighter limestone
const STONE_DK = '#b8a880'
const FRIEZE_C = '#ece4cc'   // cream inscription band
const CORN_C   = '#c8a840'   // gilded cornice
const KEY_C    = '#e0c860'   // gilded keystone
const HOVER_C  = '#ffd040'   // bright gold on hover
const ROOT_C   = '#7a7060'   // dimmed when at root

const _baseColor = new THREE.Color(STONE_C)
const _hovColor  = new THREE.Color(HOVER_C)
const _rootColor = new THREE.Color(ROOT_C)

// ── Module-level materials (entrance-specific, won't conflict with Gate.jsx) ──
const enMatStone    = new THREE.MeshLambertMaterial({ color: STONE_C  })
const enMatStoneDk  = new THREE.MeshLambertMaterial({ color: STONE_DK })
const enMatFrieze   = new THREE.MeshLambertMaterial({ color: FRIEZE_C })
const enMatCornice  = new THREE.MeshLambertMaterial({ color: CORN_C   })
const enMatKeystone = new THREE.MeshLambertMaterial({ color: KEY_C    })
const enMatBannerR  = new THREE.MeshLambertMaterial({ color: '#cc2222' })
const enMatBannerG  = new THREE.MeshLambertMaterial({ color: '#c8a000' })
const enMatTorchGl  = new THREE.MeshBasicMaterial  ({ color: '#ffaa44' })
const enMatTorchPl  = new THREE.MeshLambertMaterial({ color: '#5a3a1a' })

const noRay = () => null

// ── Eagle crown (imperial — always used for the entrance) ─────────────────────
function EntranceEagle() {
  return (
    <group>
      <mesh position={[0, 0.28, 0]} material={enMatStoneDk} raycast={noRay}>
        <boxGeometry args={[0.44, 0.54, 0.38]} />
      </mesh>
      <mesh position={[0.08, 0.73, 0.04]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
      </mesh>
      <mesh position={[0.27, 0.70, 0.04]} material={enMatStoneDk} raycast={noRay}>
        <boxGeometry args={[0.13, 0.08, 0.08]} />
      </mesh>
      <mesh position={[-0.60, 0.44, 0]} rotation={[0, 0, 0.52]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[0.78, 0.17, 0.26]} />
      </mesh>
      <mesh position={[ 0.60, 0.44, 0]} rotation={[0, 0, -0.52]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[0.78, 0.17, 0.26]} />
      </mesh>
      <mesh position={[-0.18, 0.08, 0]} material={enMatStoneDk} raycast={noRay}>
        <boxGeometry args={[0.28, 0.28, 0.36]} />
      </mesh>
    </group>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EntranceGate({ x, z }) {
  const cd  = useVfsStore(s => s.cd)
  const cwd = useVfsStore(s => s.cwd)

  const keystoneRef   = useRef()
  const hoverProgress = useRef(0)
  const [hovered, setHovered] = useState(false)
  const atRoot = cwd === '/'

  // Per-instance voussoir hover material
  const archMat = useMemo(() => new THREE.MeshLambertMaterial({
    color: STONE_C,
    emissive: new THREE.Color(HOVER_C),
    emissiveIntensity: 0,
  }), [])

  const voussoirs = useMemo(() => {
    const arr = []
    for (let i = 0; i < N_VOUS; i++) {
      const θ = Math.PI * (1 - (i + 0.5) / N_VOUS)
      arr.push({
        vx:    ARCH_R * Math.cos(θ),
        vy:    SPRING_Y + ARCH_R * Math.sin(θ),
        rz:    Math.PI / 2 + θ,
        isKey: i === ((N_VOUS - 1) >> 1),
        idx:   i,
      })
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    const lf = Math.min(1, delta * 8)
    const t  = performance.now() / 1000

    if (atRoot) {
      hoverProgress.current = THREE.MathUtils.lerp(hoverProgress.current, 0, lf)
      archMat.color.lerp(_rootColor, lf)
      archMat.emissiveIntensity = 0
      return
    }

    hoverProgress.current = THREE.MathUtils.lerp(
      hoverProgress.current, hovered ? 1 : 0, lf,
    )
    const hp = hoverProgress.current
    archMat.emissiveIntensity = hp * 0.80
    archMat.color.lerpColors(_baseColor, _hovColor, hp * 0.35)

    if (keystoneRef.current) {
      const pulse = hovered ? 1 + 0.12 * Math.sin(t * 4.0) : 1
      const ks = keystoneRef.current
      ks.scale.setScalar(
        THREE.MathUtils.lerp(ks.scale.x, pulse, Math.min(1, delta * 10)),
      )
    }
  })

  const labelText  = atRoot ? '/ (root)' : '← Back'
  const labelColor = atRoot ? ROOT_C : hovered ? HOVER_C : STONE_C

  return (
    <group
      position={[x, 0, z]}
      onClick={e => {
        e.stopPropagation()
        if (!atRoot) {
          usePlayerStore.getState().setCdTarget(x, z)
          cd('..')
        }
      }}
      onPointerOver={e => {
        e.stopPropagation()
        if (!atRoot) { setHovered(true); document.body.style.cursor = 'pointer' }
      }}
      onPointerOut={e => {
        e.stopPropagation()
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
    >

      {/* ═══════════════════════════════════════════════════════════════════
          PORTAL SCENE — night-city silhouette
          ═══════════════════════════════════════════════════════════════════ */}
      <PortalScene />

      {/* ═══════════════════════════════════════════════════════════════════
          PIERS
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[-PIER_CX, ARCH_TOP / 2, 0]} castShadow material={enMatStone} raycast={noRay}>
        <boxGeometry args={[PIER_W, ARCH_TOP, PIER_D]} />
      </mesh>
      <mesh position={[ PIER_CX, ARCH_TOP / 2, 0]} castShadow material={enMatStone} raycast={noRay}>
        <boxGeometry args={[PIER_W, ARCH_TOP, PIER_D]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          PIER DETAILS — niche alcoves + pilasters
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[-PIER_CX, 2.50, PIER_D / 2 + 0.02]} material={enMatStoneDk} raycast={noRay}>
        <boxGeometry args={[0.72, 1.60, 0.07]} />
      </mesh>
      <mesh position={[ PIER_CX, 2.50, PIER_D / 2 + 0.02]} material={enMatStoneDk} raycast={noRay}>
        <boxGeometry args={[0.72, 1.60, 0.07]} />
      </mesh>
      <mesh position={[-PIER_CX, 3.38, PIER_D / 2 + 0.02]} material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[0.74, 0.16, 0.07]} />
      </mesh>
      <mesh position={[ PIER_CX, 3.38, PIER_D / 2 + 0.02]} material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[0.74, 0.16, 0.07]} />
      </mesh>

      {/* Pilasters — left pier */}
      <mesh position={[-HW - 0.22, SPRING_Y * 0.48, PIER_D / 2 + 0.09]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[0.28, SPRING_Y * 0.94, 0.17]} />
      </mesh>
      <mesh position={[-HW - PIER_W + 0.22, SPRING_Y * 0.48, PIER_D / 2 + 0.09]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[0.28, SPRING_Y * 0.94, 0.17]} />
      </mesh>
      <mesh position={[-HW - 0.22, SPRING_Y * 0.95 + 0.13, PIER_D / 2 + 0.09]} material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[0.40, 0.23, 0.22]} />
      </mesh>
      <mesh position={[-HW - PIER_W + 0.22, SPRING_Y * 0.95 + 0.13, PIER_D / 2 + 0.09]} material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[0.40, 0.23, 0.22]} />
      </mesh>

      {/* Pilasters — right pier */}
      <mesh position={[HW + 0.22, SPRING_Y * 0.48, PIER_D / 2 + 0.09]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[0.28, SPRING_Y * 0.94, 0.17]} />
      </mesh>
      <mesh position={[HW + PIER_W - 0.22, SPRING_Y * 0.48, PIER_D / 2 + 0.09]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[0.28, SPRING_Y * 0.94, 0.17]} />
      </mesh>
      <mesh position={[HW + 0.22, SPRING_Y * 0.95 + 0.13, PIER_D / 2 + 0.09]} material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[0.40, 0.23, 0.22]} />
      </mesh>
      <mesh position={[HW + PIER_W - 0.22, SPRING_Y * 0.95 + 0.13, PIER_D / 2 + 0.09]} material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[0.40, 0.23, 0.22]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          ARCH VOUSSOIRS — 9 wedge stones; centre one is the gilded keystone
          ═══════════════════════════════════════════════════════════════════ */}
      {voussoirs.map(({ vx, vy, rz, isKey, idx }) => (
        <mesh
          key={idx}
          ref={isKey ? keystoneRef : undefined}
          position={[vx, vy, 0]}
          rotation={[0, 0, rz]}
          material={isKey ? enMatKeystone : archMat}
          castShadow
          raycast={noRay}
        >
          <boxGeometry args={[VOUS_W, RADIAL_D, PIER_D + 0.08]} />
        </mesh>
      ))}

      {/* ═══════════════════════════════════════════════════════════════════
          ENTABLATURE — architrave / frieze / cornice
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[0, ENT_Y + 0.14, 0]} castShadow material={enMatStone} raycast={noRay}>
        <boxGeometry args={[FULL_W, 0.28, PIER_D + 0.06]} />
      </mesh>
      <mesh position={[0, ENT_Y + 0.57, 0]} material={enMatFrieze} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.10, 0.44, PIER_D + 0.02]} />
      </mesh>
      <mesh position={[0, ENT_Y + 0.97, 0]} castShadow material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.20, 0.30, PIER_D + 0.30]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          ATTIC STOREY — inscription panel + pier projections
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[0, ATTIC_Y + ATTIC_H / 2, 0]} castShadow material={enMatStone} raycast={noRay}>
        <boxGeometry args={[FULL_W - 0.04, ATTIC_H, PIER_D - 0.14]} />
      </mesh>
      <mesh position={[0, ATTIC_Y + 0.10, 0]} material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[FULL_W + 0.12, 0.18, PIER_D + 0.06]} />
      </mesh>
      <mesh position={[-PIER_CX, ATTIC_Y + ATTIC_H / 2, PIER_D / 2 - 0.08 + 0.10]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[PIER_W * 0.68, ATTIC_H, 0.16]} />
      </mesh>
      <mesh position={[ PIER_CX, ATTIC_Y + ATTIC_H / 2, PIER_D / 2 - 0.08 + 0.10]} material={enMatStone} raycast={noRay}>
        <boxGeometry args={[PIER_W * 0.68, ATTIC_H, 0.16]} />
      </mesh>
      <mesh position={[0, ATTIC_Y + ATTIC_H / 2, PIER_D / 2 - 0.06 + 0.05]} material={enMatFrieze} raycast={noRay}>
        <boxGeometry args={[2.40, ATTIC_H * 0.66, 0.08]} />
      </mesh>
      <mesh position={[0, ATTIC_TOP - 0.06, 0]} material={enMatCornice} raycast={noRay}>
        <boxGeometry args={[FULL_W, 0.12, PIER_D - 0.06]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          CROWN — imperial eagle (always)
          ═══════════════════════════════════════════════════════════════════ */}
      <group position={[0, ATTIC_TOP, 0]}>
        <EntranceEagle />
      </group>

      {/* ═══════════════════════════════════════════════════════════════════
          BANNERS — crimson left, gold right (imperial colours)
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh
        position={[-FULL_W / 2 + 0.30, ENT_Y - 0.52, PIER_D / 2 + 0.08]}
        material={enMatBannerR} raycast={noRay}
      >
        <boxGeometry args={[0.36, 1.04, 0.04]} />
      </mesh>
      <mesh
        position={[-FULL_W / 2 + 0.30, ENT_Y - 0.02, PIER_D / 2 + 0.08]}
        material={enMatStoneDk} raycast={noRay}
      >
        <boxGeometry args={[0.40, 0.07, 0.07]} />
      </mesh>
      <mesh
        position={[FULL_W / 2 - 0.30, ENT_Y - 0.52, PIER_D / 2 + 0.08]}
        material={enMatBannerG} raycast={noRay}
      >
        <boxGeometry args={[0.36, 1.04, 0.04]} />
      </mesh>
      <mesh
        position={[FULL_W / 2 - 0.30, ENT_Y - 0.02, PIER_D / 2 + 0.08]}
        material={enMatStoneDk} raycast={noRay}
      >
        <boxGeometry args={[0.40, 0.07, 0.07]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          TORCHES — always lit at the entrance
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[-1.80, 3.20, PIER_D / 2 + 0.24]} material={enMatTorchPl} raycast={noRay}>
        <boxGeometry args={[0.09, 0.80, 0.09]} />
      </mesh>
      <mesh position={[-1.80, 3.68, PIER_D / 2 + 0.24]} material={enMatTorchGl} raycast={noRay}>
        <boxGeometry args={[0.20, 0.20, 0.20]} />
      </mesh>
      <mesh position={[1.80, 3.20, PIER_D / 2 + 0.24]} material={enMatTorchPl} raycast={noRay}>
        <boxGeometry args={[0.09, 0.80, 0.09]} />
      </mesh>
      <mesh position={[1.80, 3.68, PIER_D / 2 + 0.24]} material={enMatTorchGl} raycast={noRay}>
        <boxGeometry args={[0.20, 0.20, 0.20]} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          INVISIBLE CLICK TARGET
          ═══════════════════════════════════════════════════════════════════ */}
      <mesh position={[0, SPRING_Y / 2, 0]} visible={false}>
        <boxGeometry args={[FULL_W, ARCH_TOP, 2.0]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* ═══════════════════════════════════════════════════════════════════
          LABEL — billboard above the crown
          ═══════════════════════════════════════════════════════════════════ */}
      <Text
        position={[0, ATTIC_TOP + 1.40, 0]}
        fontSize={0.44}
        color="#111111"
        outlineColor={labelColor}
        outlineWidth={0.05}
        anchorX="center"
        anchorY="bottom"
        billboard
      >
        {labelText}
      </Text>

    </group>
  )
}
