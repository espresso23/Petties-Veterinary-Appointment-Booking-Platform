import { create } from 'zustand'
import { getBookingsByClinic, getBookingsByStaff } from '../services/bookingService'
import type { BookingStatus } from '../types/booking'

interface BookingState {
  // Booking counts for sidebar badges
  pendingBookingCount: number  // For Manager: PENDING bookings count
  assignedBookingCount: number // For Staff: CONFIRMED bookings count (assigned to them)
  isLoading: boolean

  // Actions
  setPendingBookingCount: (count: number) => void
  setAssignedBookingCount: (count: number) => void
  incrementPendingBookingCount: () => void
  incrementAssignedBookingCount: () => void
  decrementPendingBookingCount: () => void
  decrementAssignedBookingCount: () => void
  refreshPendingBookingCount: (clinicId: string) => Promise<void>
  refreshAssignedBookingCount: (staffId: string) => Promise<void>
  reset: () => void
}

const initialState = {
  pendingBookingCount: 0,
  assignedBookingCount: 0,
  isLoading: false,
}

/**
 * Zustand store for managing booking count badges
 * Used in sidebar navigation for Manager and Vet
 */
export const useBookingStore = create<BookingState>((set, get) => ({
  ...initialState,

  setPendingBookingCount: (count: number) => {
    set({ pendingBookingCount: count })
  },

  setAssignedBookingCount: (count: number) => {
    set({ assignedBookingCount: count })
  },

  incrementPendingBookingCount: () => {
    set((state) => ({ pendingBookingCount: state.pendingBookingCount + 1 }))
  },

  incrementAssignedBookingCount: () => {
    set((state) => ({ assignedBookingCount: state.assignedBookingCount + 1 }))
  },

  decrementPendingBookingCount: () => {
    const current = get().pendingBookingCount
    if (current > 0) {
      set({ pendingBookingCount: current - 1 })
    }
  },

  decrementAssignedBookingCount: () => {
    const current = get().assignedBookingCount
    if (current > 0) {
      set({ assignedBookingCount: current - 1 })
    }
  },

  refreshPendingBookingCount: async (clinicId: string) => {
    try {
      set({ isLoading: true })
      // Fetch PENDING bookings count for Manager
      const response = await getBookingsByClinic(clinicId, 'PENDING' as BookingStatus, undefined, 0, 1)
      set({ pendingBookingCount: response.totalElements, isLoading: false })
    } catch (error) {
      console.error('Failed to refresh pending booking count:', error)
      set({ isLoading: false })
    }
  },

  refreshAssignedBookingCount: async (staffId: string) => {
    try {
      set({ isLoading: true })
      // Fetch CONFIRMED bookings count for Staff
      const response = await getBookingsByStaff(staffId, 'CONFIRMED' as BookingStatus, 0, 1)
      set({ assignedBookingCount: response.totalElements, isLoading: false })
    } catch (error) {
      console.error('Failed to refresh assigned booking count:', error)
      set({ isLoading: false })
    }
  },

  reset: () => {
    set(initialState)
  },
}))
