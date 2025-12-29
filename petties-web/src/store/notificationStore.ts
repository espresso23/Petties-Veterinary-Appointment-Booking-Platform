import { create } from 'zustand'
import { notificationService } from '../services/api/notificationService'

interface NotificationState {
  unreadCount: number
  isLoading: boolean
  setUnreadCount: (count: number) => void
  refreshUnreadCount: () => Promise<void>
  decrementUnreadCount: () => void
  resetUnreadCount: () => void
}

/**
 * Zustand store for managing notification state
 * Shared across components to keep unread count synchronized
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  unreadCount: 0,
  isLoading: false,
  setUnreadCount: (count: number) => {
    set({ unreadCount: count })
  },
  refreshUnreadCount: async () => {
    try {
      set({ isLoading: true })
      const count = await notificationService.getUnreadCount()
      set({ unreadCount: count, isLoading: false })
    } catch (error) {
      console.error('Failed to refresh unread count', error)
      set({ isLoading: false })
    }
  },
  decrementUnreadCount: () => {
    const current = get().unreadCount
    if (current > 0) {
      set({ unreadCount: current - 1 })
    }
  },
  resetUnreadCount: () => {
    set({ unreadCount: 0 })
  },
}))

