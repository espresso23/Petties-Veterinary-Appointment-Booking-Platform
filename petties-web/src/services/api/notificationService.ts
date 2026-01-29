import { apiClient } from './client'

export interface ClinicNotification {
  notificationId: string
  clinicId?: string
  clinicName?: string
  type: 'APPROVED' | 'REJECTED' | 'PENDING' | 'CLINIC_PENDING_APPROVAL' | 'STAFF_SHIFT_ASSIGNED' | 'STAFF_SHIFT_UPDATED' | 'STAFF_SHIFT_DELETED'
  message: string
  reason?: string
  read: boolean
  createdAt: string
  // StaffShift-related fields
  shiftId?: string
  shiftDate?: string
  shiftStartTime?: string
  shiftEndTime?: string
}

export interface NotificationListResponse {
  content: ClinicNotification[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export const notificationService = {
  /**
   * Get notifications for current user
   */
  getNotifications: async (page = 0, size = 20): Promise<NotificationListResponse> => {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
    })
    const response = await apiClient.get<NotificationListResponse>(`/notifications/me?${params.toString()}`)
    return response.data
  },

  /**
   * Get unread notifications count
   */
  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get<{ count: number }>('/notifications/me/unread-count')
    return response.data.count
  },

  /**
   * Mark notification as read
   */
  markAsRead: async (notificationId: string): Promise<void> => {
    await apiClient.put(`/notifications/${notificationId}/read`)
  },

  /**
   * Mark all notifications as read
   */
  markAllAsRead: async (): Promise<void> => {
    await apiClient.put('/notifications/me/mark-all-read')
  },
}
