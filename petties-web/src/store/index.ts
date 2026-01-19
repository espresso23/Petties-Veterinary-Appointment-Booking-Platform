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

// Export userStore
export { useUserStore } from './userStore'

// Export clinicStore
export { useClinicStore } from './clinicStore'

// Export notificationStore
export { useNotificationStore } from './notificationStore'

// Export bookingStore
export { useBookingStore } from './bookingStore'

