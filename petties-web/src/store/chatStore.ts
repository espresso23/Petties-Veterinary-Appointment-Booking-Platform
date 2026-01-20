import { create } from 'zustand'
import { chatService } from '../services/api/chatService'

interface ChatState {
  unreadCount: number
  activeConversationId: string | null
  isLoading: boolean
  setUnreadCount: (count: number) => void
  incrementUnreadCount: () => void
  refreshUnreadCount: () => Promise<void>
  decrementUnreadCount: (amount?: number) => void
  resetUnreadCount: () => void
  setActiveConversationId: (id: string | null) => void
}

/**
 * Zustand store for managing chat unread count state
 * Shared across components to keep chat unread count synchronized
 */
export const useChatStore = create<ChatState>((set) => ({
  unreadCount: 0,
  activeConversationId: null, // Track active chat globally
  isLoading: false,
  setActiveConversationId: (id: string | null) => set({ activeConversationId: id }),
  setUnreadCount: (count: number) => {
    set({ unreadCount: count })
  },
  incrementUnreadCount: () => {
    set((state) => ({ unreadCount: state.unreadCount + 1 }))
  },
  refreshUnreadCount: async () => {
    try {
      set({ isLoading: true })
      const response = await chatService.getUnreadCount()
      set({ unreadCount: response.totalUnreadConversations, isLoading: false })
    } catch (error) {
      console.error('Failed to refresh chat unread count', error)
      set({ isLoading: false })
    }
  },
  decrementUnreadCount: (amount: number = 1) => {
    set((state) => ({ unreadCount: Math.max(0, state.unreadCount - amount) }))
  },
  resetUnreadCount: () => {
    set({ unreadCount: 0 })
  },
}))