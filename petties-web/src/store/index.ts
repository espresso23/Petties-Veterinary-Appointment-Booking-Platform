import { create } from 'zustand'

type AppState = {
  isBootstrapped: boolean
  markBootstrapped: () => void
}

export const useAppStore = create<AppState>((set) => ({
  isBootstrapped: false,
  markBootstrapped: () => set({ isBootstrapped: true }),
}))

// Export authStore
export { useAuthStore } from './authStore'

