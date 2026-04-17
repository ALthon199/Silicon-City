import { create } from 'zustand'

export const SPAWN_X = 0
export const SPAWN_Z = 26

export const usePlayerStore = create((set) => ({
  x: SPAWN_X,
  z: SPAWN_Z,
  setPosition: (x, z) => set({ x, z }),
  // pendingTeleport is consumed each frame by Player; null = no pending teleport
  pendingTeleport: null,
  teleportTo: (x, z) => set({ pendingTeleport: { x, z } }),
  clearTeleport: () => set({ pendingTeleport: null }),

  // ── cd-transition camera overrides ─────────────────────────────────────────
  // cdTarget: pan camera toward this gate position during the transition
  // cdZoom:   override zoom to a large value so we zoom into the arch
  cdTarget: null,
  cdZoom:   null,
  setCdTarget: (x, z, zoom = 52) => set({ cdTarget: { x, z }, cdZoom: zoom }),
  clearCdTarget: ()               => set({ cdTarget: null,      cdZoom: null  }),
}))
