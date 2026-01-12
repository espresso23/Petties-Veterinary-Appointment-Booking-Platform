import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificationService } from '../../services/api/notificationService'
import type { ClinicNotification } from '../../services/api/notificationService'
import { useToast } from '../../components/Toast'
import { useNotificationStore } from '../../store/notificationStore'
import { useSseNotification } from '../../hooks/useSseNotification'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import '../../styles/brutalist.css'

/**
 * Vet Notifications Page - Neobrutalism Design
 * Shows VetShift notifications (assigned, updated, deleted)
 */
export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<ClinicNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const { showToast } = useToast()
  const navigate = useNavigate()
  // Use Zustand store for unread count (synced with sidebar)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)

  // SSE hook for real-time notifications
  useSseNotification({
    onNotification: () => {
      // Refresh when new notification arrives
      loadNotifications()
    },
  })

  const loadNotifications = async () => {
    try {
      setLoading(true)
      const data = await notificationService.getNotifications(page, 20)
      setNotifications(data.content)
      setTotalPages(data.totalPages)
      setTotalElements(data.totalElements)
    } catch (error: any) {
      showToast('error', 'Không thể tải thông báo')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadUnreadCount = async () => {
    await refreshUnreadCount()
  }

  useEffect(() => {
    loadNotifications()
    loadUnreadCount()
  }, [page])

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId)
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, read: true } : n))
      )
      // Refresh unread count immediately to update sidebar
      await refreshUnreadCount()
    } catch (error: any) {
      showToast('error', 'Không thể đánh dấu đã đọc')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      // Refresh unread count immediately to update sidebar
      await refreshUnreadCount()
      showToast('success', 'Đã đánh dấu tất cả đã đọc')
    } catch (error: any) {
      showToast('error', 'Không thể đánh dấu tất cả đã đọc')
    }
  }

  // Get navigation route based on notification type
  const getNavigationRoute = (notification: ClinicNotification): string | null => {
    switch (notification.type) {
      case 'VET_SHIFT_ASSIGNED':
      case 'VET_SHIFT_UPDATED':
      case 'VET_SHIFT_DELETED':
        return '/vet/schedule'
      default:
        return null
    }
  }

  // Handle notification click - mark as read and navigate
  const handleNotificationClick = async (notification: ClinicNotification) => {
    // Mark as read first if unread
    if (!notification.read) {
      await handleMarkAsRead(notification.notificationId)
    }
    // Navigate to relevant page
    const route = getNavigationRoute(notification)
    if (route) {
      navigate(route)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'APPROVED':
        return 'bg-green-100 border-green-600'
      case 'REJECTED':
        return 'bg-red-100 border-red-600'
      case 'VET_SHIFT_ASSIGNED':
        return 'bg-amber-100 border-amber-600'
      case 'VET_SHIFT_UPDATED':
        return 'bg-blue-100 border-blue-600'
      case 'VET_SHIFT_DELETED':
        return 'bg-orange-100 border-orange-600'
      default:
        return 'bg-stone-100 border-stone-600'
    }
  }

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'APPROVED':
        return 'PHÒNG KHÁM ĐÃ ĐƯỢC DUYỆT'
      case 'REJECTED':
        return 'PHÒNG KHÁM KHÔNG ĐƯỢC DUYỆT'
      case 'VET_SHIFT_ASSIGNED':
        return 'BẠN ĐƯỢC GÁN CA LÀM VIỆC'
      case 'VET_SHIFT_UPDATED':
        return 'CA LÀM VIỆC ĐÃ ĐƯỢC CẬP NHẬT'
      case 'VET_SHIFT_DELETED':
        return 'CA LÀM VIỆC ĐÃ BỊ XÓA'
      default:
        return 'THÔNG BÁO'
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'VET_SHIFT_ASSIGNED':
        return (
          <div className="w-10 h-10 bg-amber-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )
      case 'VET_SHIFT_UPDATED':
        return (
          <div className="w-10 h-10 bg-blue-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        )
      case 'VET_SHIFT_DELETED':
        return (
          <div className="w-10 h-10 bg-orange-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        )
      case 'APPROVED':
        return (
          <div className="w-10 h-10 bg-green-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'REJECTED':
        return (
          <div className="w-10 h-10 bg-red-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-10 h-10 bg-stone-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
            THÔNG BÁO
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-stone-600">
              {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="btn-brutal py-2 px-4 text-sm"
            >
              ĐÁNH DẤU TẤT CẢ ĐÃ ĐỌC
            </button>
          )}
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="btn-brutal py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            LÀM MỚI
          </button>
        </div>
      </header>

      {/* Notifications List */}
      <div className="space-y-4">
        {loading && notifications.length === 0 ? (
          <div className="bg-white border-4 border-stone-900 shadow-brutal p-12 text-center">
            <p className="text-stone-600 font-bold">Đang tải...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-white border-4 border-stone-900 shadow-brutal p-12 text-center">
            <p className="text-stone-600 font-bold uppercase">Không có thông báo nào</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.notificationId}
              onClick={() => handleNotificationClick(notification)}
              className={`bg-white border-4 shadow-brutal p-6 transition-all cursor-pointer hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] ${notification.read ? 'border-stone-300' : 'border-stone-900'
                } ${getNotificationStyle(notification.type)}`}
            >
              <div className="flex items-start gap-4">
                {getNotificationIcon(notification.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-black uppercase text-black">
                      {getNotificationTitle(notification.type)}
                    </h3>
                    {!notification.read && (
                      <span className="px-2 py-1 bg-red-600 text-white text-xs font-bold uppercase border-2 border-black">
                        MỚI
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-stone-700 mb-2">{notification.message}</p>
                  {notification.shiftDate && (
                    <div className="mt-2 p-2 bg-white border-2 border-black inline-block">
                      <p className="text-xs font-bold text-stone-600">
                        Ngày: {notification.shiftDate} | {notification.shiftStartTime} - {notification.shiftEndTime}
                      </p>
                    </div>
                  )}
                  {notification.clinicName && (
                    <p className="text-sm font-bold text-stone-600 mt-2">
                      Phòng khám: {notification.clinicName}
                    </p>
                  )}
                  {notification.reason && (
                    <div className="mt-3 p-3 bg-white border-2 border-black">
                      <p className="text-xs font-bold uppercase text-stone-600 mb-1">Lý do:</p>
                      <p className="text-sm font-bold text-black">{notification.reason}</p>
                    </div>
                  )}
                  <p className="text-xs text-stone-600 mt-3">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
                {!notification.read && (
                  <button
                    onClick={() => handleMarkAsRead(notification.notificationId)}
                    className="ml-4 px-3 py-1.5 bg-yellow-400 text-stone-900 text-[10px] font-black uppercase border-2 border-stone-900 shadow-[3px_3px_0_0_#000] hover:bg-yellow-500 hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
                  >
                    Đánh dấu đã đọc
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 bg-white border-4 border-stone-900 shadow-brutal p-4 flex items-center justify-between">
          <div className="text-sm font-bold text-stone-700">
            Trang {page + 1} / {totalPages} ({totalElements} thông báo)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-4 py-2 bg-white text-stone-900 text-sm font-bold uppercase border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trước
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-4 py-2 bg-white text-stone-900 text-sm font-bold uppercase border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationsPage
