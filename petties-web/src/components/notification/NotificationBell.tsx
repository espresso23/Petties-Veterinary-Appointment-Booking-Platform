import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationService, type ClinicNotification } from '../../services/api/notificationService'
import { useNotificationStore } from '../../store/notificationStore'
import { useSseNotification } from '../../hooks/useSseNotification'

interface NotificationBellProps {
  /** Path to navigate to when clicking "View All" */
  viewAllPath?: string
  /** Callback when notification is clicked */
  onNotificationClick?: (notification: ClinicNotification) => void
}

/**
 * NotificationBell Component
 *
 * Features:
 * - Real-time notification badge with SSE
 * - Dropdown with recent notifications
 * - Mark as read on click
 * - Navigate to notification page
 *
 * Design: Neobrutalism - black borders, offset shadows, no rounded corners
 */
export function NotificationBell({
  viewAllPath = '/notifications',
  onNotificationClick,
}: NotificationBellProps) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<ClinicNotification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // SSE hook for real-time updates
  const { unreadCount, isConnected } = useSseNotification({
    onNotification: () => {
      // Refresh notification list when new notification arrives
      if (isOpen) {
        fetchNotifications()
      }
    },
  })

  // Get unread count from store (synced by SSE hook)
  const storeUnreadCount = useNotificationStore((state) => state.unreadCount)
  const decrementUnreadCount = useNotificationStore((state) => state.decrementUnreadCount)

  // Use SSE unreadCount if connected, otherwise use store
  const displayUnreadCount = isConnected ? unreadCount : storeUnreadCount

  // Fetch recent notifications
  const fetchNotifications = async () => {
    try {
      setIsLoading(true)
      const response = await notificationService.getNotifications(0, 5)
      setNotifications(response.content)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle bell click
  const handleBellClick = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      fetchNotifications()
    }
  }

  // Handle notification click
  const handleNotificationClick = async (notification: ClinicNotification) => {
    // Mark as read if unread
    if (!notification.read) {
      try {
        await notificationService.markAsRead(notification.notificationId)
        decrementUnreadCount()
        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.notificationId === notification.notificationId ? { ...n, read: true } : n
          )
        )
      } catch (error) {
        console.error('Failed to mark notification as read:', error)
      }
    }

    // Call callback if provided
    onNotificationClick?.(notification)

    // Close dropdown
    setIsOpen(false)
  }

  // Handle view all click
  const handleViewAllClick = () => {
    setIsOpen(false)
    navigate(viewAllPath)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Vua xong'
    if (diffMins < 60) return `${diffMins} phut truoc`
    if (diffHours < 24) return `${diffHours} gio truoc`
    if (diffDays < 7) return `${diffDays} ngay truoc`
    return date.toLocaleDateString('vi-VN')
  }

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'APPROVED':
        return (
          <div className="w-8 h-8 bg-green-100 border-2 border-stone-900 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )
      case 'REJECTED':
        return (
          <div className="w-8 h-8 bg-red-100 border-2 border-stone-900 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )
      case 'VET_SHIFT_ASSIGNED':
      case 'VET_SHIFT_UPDATED':
        return (
          <div className="w-8 h-8 bg-amber-100 border-2 border-stone-900 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )
      case 'VET_SHIFT_DELETED':
        return (
          <div className="w-8 h-8 bg-orange-100 border-2 border-stone-900 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 bg-stone-100 border-2 border-stone-900 flex items-center justify-center">
            <svg
              className="w-4 h-4 text-stone-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </div>
        )
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={handleBellClick}
        className="relative p-2 border-4 border-stone-900 bg-white hover:bg-stone-50 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        style={{ boxShadow: '4px 4px 0 #1c1917' }}
        aria-label="Thong bao"
      >
        {/* Bell Icon */}
        <svg
          className="w-6 h-6 text-stone-900"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {displayUnreadCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 flex items-center justify-center bg-red-500 border-2 border-stone-900 text-white text-xs font-bold">
            {displayUnreadCount > 99 ? '99+' : displayUnreadCount}
          </span>
        )}

        {/* SSE Connection indicator */}
        {isConnected && (
          <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 border border-stone-900" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white border-4 border-stone-900 z-50"
          style={{ boxShadow: '8px 8px 0 #1c1917' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b-4 border-stone-900 bg-amber-50">
            <h3 className="text-sm font-bold uppercase tracking-wide text-stone-900">
              Thong bao
            </h3>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-stone-500">
                <div className="animate-pulse">Dang tai...</div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-stone-500">
                Khong co thong bao
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.notificationId}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full px-4 py-3 border-b-2 border-stone-200 text-left hover:bg-stone-50 transition-colors ${
                    !notification.read ? 'bg-amber-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getNotificationIcon(notification.type)}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          !notification.read ? 'font-bold text-stone-900' : 'text-stone-700'
                        } line-clamp-2`}
                      >
                        {notification.message}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        {formatTime(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-amber-500 border border-stone-900 flex-shrink-0 mt-2" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t-4 border-stone-900 bg-stone-50">
            <button
              onClick={handleViewAllClick}
              className="w-full text-center text-sm font-bold text-amber-600 uppercase tracking-wide hover:text-amber-700"
            >
              Xem tat ca
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
