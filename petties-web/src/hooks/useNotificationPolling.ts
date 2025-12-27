import { useEffect, useRef } from 'react'
import { notificationService } from '../services/api/notificationService'
import { useToast } from '../components/Toast'
import { useNotificationStore } from '../store/notificationStore'

interface UseNotificationPollingOptions {
  /** Polling interval in milliseconds. Default: 30000 (30 seconds) */
  interval?: number
  /** Number of notifications to fetch when checking for new ones. Default: 5 */
  fetchLimit?: number
}

interface UseNotificationPollingReturn {
  /** Current unread notification count */
  unreadCount: number
}

/**
 * Custom hook for polling clinic notifications
 * 
 * Features:
 * - Polls for new notifications at specified interval
 * - Shows toast for new unread notifications
 * - Prevents duplicate toast notifications
 * - Tracks unread count
 */
export function useNotificationPolling(
  options: UseNotificationPollingOptions = {}
): UseNotificationPollingReturn {
  const { interval = 30000, fetchLimit = 5 } = options
  const { showToast } = useToast()
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  
  const previousCountRef = useRef(0)
  const shownNotificationIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const count = await notificationService.getUnreadCount()
        const previousCount = previousCountRef.current

        if (count > previousCount && previousCount >= 0) {
          // New notification arrived - fetch latest notifications
          const notifications = await notificationService.getNotifications(0, fetchLimit)

          // Find the first unread notification that hasn't been shown yet
          for (const notification of notifications.content) {
            if (!notification.read && !shownNotificationIdsRef.current.has(notification.notificationId)) {
              // Mark this notification as shown
              shownNotificationIdsRef.current.add(notification.notificationId)

              // Show toast only for the first new notification
              const message = notification.type === 'APPROVED'
                ? `Phòng khám "${notification.clinicName}" đã được duyệt${notification.reason ? `: ${notification.reason}` : ''}`
                : `Phòng khám "${notification.clinicName}" không được duyệt${notification.reason ? `: ${notification.reason}` : ''}`
              
              showToast(
                notification.type === 'APPROVED' ? 'success' : 'error',
                message
              )
              break // Only show toast for the first new notification
            }
          }
        }

        previousCountRef.current = count
        setUnreadCount(count) // Update Zustand store (will trigger re-render for components using it)
      } catch (error) {
        console.error('Failed to check notifications', error)
      }
    }

    // Initial check
    checkNotifications()

    // Poll at specified interval
    const pollingInterval = setInterval(checkNotifications, interval)

    return () => {
      clearInterval(pollingInterval)
      // Clean up shown notification IDs on unmount
      shownNotificationIdsRef.current.clear()
    }
  }, [showToast, interval, fetchLimit])

  return {
    unreadCount,
  }
}

export default useNotificationPolling

