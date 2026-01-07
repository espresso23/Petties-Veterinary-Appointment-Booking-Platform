import { useEffect, useRef, useCallback, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { useClinicStore } from '../store/clinicStore'
import { useToast } from '../components/Toast'
import { env } from '../config/env'

/**
 * SSE Event types from backend
 */
type SseEventType = 'NOTIFICATION' | 'HEARTBEAT' | 'SHIFT_UPDATE' | 'CLINIC_COUNTER_UPDATE'

/**
 * Notification type enum matching backend
 */
type NotificationType =
  | 'APPROVED'
  | 'REJECTED'
  | 'PENDING'
  | 'VET_SHIFT_ASSIGNED'
  | 'VET_SHIFT_UPDATED'
  | 'VET_SHIFT_DELETED'

/**
 * SSE Event data structure from backend
 */
interface SseEventData {
  type: SseEventType
  data: NotificationData | null
  timestamp: string
}

/**
 * Notification data from SSE push
 */
interface NotificationData {
  notificationId: string
  type: NotificationType
  message: string
  reason?: string
  read: boolean
  createdAt: string
  // Clinic-related fields
  clinicId?: string
  clinicName?: string
  // VetShift-related fields
  shiftId?: string
  shiftDate?: string
  shiftStartTime?: string
  shiftEndTime?: string
}

interface UseSseNotificationOptions {
  /** Auto-reconnect delay in ms (default: 5000) */
  reconnectDelay?: number
  /** Max reconnect attempts before giving up (default: 10) */
  maxReconnectAttempts?: number
  /** Callback when new notification received */
  onNotification?: (notification: NotificationData) => void
  /** Callback when shift update received */
  onShiftUpdate?: (data: unknown) => void
}

interface UseSseNotificationReturn {
  /** Whether SSE is currently connected */
  isConnected: boolean
  /** Current unread notification count */
  unreadCount: number
  /** Manually disconnect from SSE */
  disconnect: () => void
  /** Manually reconnect to SSE */
  reconnect: () => void
}

/**
 * Custom hook for SSE (Server-Sent Events) notifications
 *
 * Features:
 * - Auto-connects when user is authenticated
 * - Auto-disconnects on logout
 * - Auto-reconnect on connection loss
 * - Shows toast for new notifications
 * - Updates unread count in real-time
 *
 * @example
 * ```tsx
 * const { isConnected, unreadCount } = useSseNotification({
 *   onNotification: (notification) => {
 *     console.log('New notification:', notification)
 *   }
 * })
 * ```
 */
export function useSseNotification(
  options: UseSseNotificationOptions = {}
): UseSseNotificationReturn {
  const {
    reconnectDelay = 5000,
    maxReconnectAttempts = 10,
    onNotification,
    onShiftUpdate,
  } = options

  const { accessToken, isAuthenticated } = useAuthStore()
  const { showToast } = useToast()
  const { unreadCount, incrementUnreadCount, refreshUnreadCount } = useNotificationStore()
  const { setPendingCount } = useClinicStore()

  const [isConnected, setIsConnected] = useState(false)

  // Use refs for callbacks to avoid re-creating handleSseEvent when they change
  const onNotificationRef = useRef(onNotification)
  const onShiftUpdateRef = useRef(onShiftUpdate)

  useEffect(() => {
    onNotificationRef.current = onNotification
  }, [onNotification])

  useEffect(() => {
    onShiftUpdateRef.current = onShiftUpdate
  }, [onShiftUpdate])

  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Generate SSE URL with token
  const getSseUrl = useCallback(() => {
    if (!accessToken) return null
    // SSE endpoint is at /api/sse/subscribe (context-path is /api)
    const baseUrl = env.API_BASE_URL
    return `${baseUrl}/sse/subscribe?token=${encodeURIComponent(accessToken)}`
  }, [accessToken])

  // Show toast based on notification type
  const showNotificationToast = useCallback(
    (notification: NotificationData) => {
      const { type, message, clinicName } = notification

      switch (type) {
        case 'APPROVED':
          showToast('success', message || `Phong kham "${clinicName}" da duoc duyet`)
          break
        case 'REJECTED':
          showToast('error', message || `Phong kham "${clinicName}" khong duoc duyet`)
          break
        case 'VET_SHIFT_ASSIGNED':
          showToast('info', message || 'Ban duoc gan ca lam viec moi')
          break
        case 'VET_SHIFT_UPDATED':
          showToast('warning', message || 'Ca lam viec cua ban da duoc cap nhat')
          break
        case 'VET_SHIFT_DELETED':
          showToast('warning', message || 'Ca lam viec cua ban da bi xoa')
          break
        default:
          showToast('info', message || 'Thong bao moi')
      }
    },
    [showToast]
  )

  // Handle incoming SSE events
  const handleSseEvent = useCallback(
    (event: MessageEvent) => {
      try {
        const data: SseEventData = JSON.parse(event.data)

        switch (data.type) {
          case 'NOTIFICATION':
            if (data.data) {
              console.log('[SSE] Notification received:', data.data)
              // Increment unread count
              incrementUnreadCount()
              // Show toast
              showNotificationToast(data.data as NotificationData)
              // Call callback
              onNotificationRef.current?.(data.data as NotificationData)
            }
            break

          case 'SHIFT_UPDATE':
            console.log('[SSE] Shift update received:', data.data)
            // Trigger callback for shift updates (e.g., refresh VetShift list)
            onShiftUpdateRef.current?.(data.data)
            break

          case 'CLINIC_COUNTER_UPDATE':
            console.log('[SSE] Clinic counter update received:', data.data)
            if (typeof data.data === 'number') {
              setPendingCount(data.data)
            }
            break

          case 'HEARTBEAT':
            // Heartbeat received - connection is alive
            if (import.meta.env.DEV) {
              console.log('[SSE] Heartbeat received at', data.timestamp)
            }
            break

          default:
            console.warn('[SSE] Unknown event type:', data.type)
        }
      } catch (error) {
        console.error('[SSE] Failed to parse event data:', error)
      }
    },
    [incrementUnreadCount, showNotificationToast, setPendingCount]
  )

  // Connect to SSE
  const connect = useCallback(() => {
    const url = getSseUrl()
    if (!url) {
      console.warn('[SSE] Cannot connect: No access token')
      return
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const eventSource = new EventSource(url, {
        withCredentials: true,
      })

      eventSource.onopen = () => {
        console.log('[SSE] Connected successfully')
        setIsConnected(true)
        reconnectAttemptsRef.current = 0
        // Refresh unread count on connect
        refreshUnreadCount()
      }

      // Listen for named events
      eventSource.addEventListener('NOTIFICATION', handleSseEvent)
      eventSource.addEventListener('HEARTBEAT', handleSseEvent)
      eventSource.addEventListener('SHIFT_UPDATE', handleSseEvent)
      eventSource.addEventListener('CLINIC_COUNTER_UPDATE', handleSseEvent)

      // Also handle generic message events
      eventSource.onmessage = (event) => {
        handleSseEvent(event)
      }

      eventSource.onerror = (error) => {
        console.error('[SSE] Connection error:', error)
        setIsConnected(false)
        eventSource.close()

        // Auto-reconnect if within max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts && isAuthenticated) {
          reconnectAttemptsRef.current++
          console.log(
            `[SSE] Reconnecting in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
          )
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectDelay)
        } else {
          console.warn('[SSE] Max reconnect attempts reached, stopping')
        }
      }

      eventSourceRef.current = eventSource
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error)
    }
  }, [
    getSseUrl,
    handleSseEvent,
    isAuthenticated,
    maxReconnectAttempts,
    reconnectDelay,
    refreshUnreadCount,
  ])

  // Disconnect from SSE
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setIsConnected(false)
    reconnectAttemptsRef.current = 0
    console.log('[SSE] Disconnected')
  }, [])

  // Manual reconnect
  const reconnect = useCallback(() => {
    disconnect()
    reconnectAttemptsRef.current = 0
    connect()
  }, [connect, disconnect])

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [isAuthenticated, accessToken, connect, disconnect])

  return {
    isConnected,
    unreadCount,
    disconnect,
    reconnect,
  }
}

export default useSseNotification
