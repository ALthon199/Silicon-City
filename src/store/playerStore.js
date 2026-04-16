import { create } from 'zustand'

export const usePlayerStore = create((set) => ({
  x: 0,
  z: 0,
  setPosition: (x, z) => set({ x, z }),
}))
