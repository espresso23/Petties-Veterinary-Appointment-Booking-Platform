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
 * Admin Notifications Page - Neobrutalism Design
 * Shows all system notifications for admin
 */
export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<ClinicNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const { showToast } = useToast()
  const navigate = useNavigate()
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)

  // SSE hook for real-time notifications
  useSseNotification({
    onNotification: () => {
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

  const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await notificationService.markAsRead(notificationId)
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, read: true } : n))
      )
      await refreshUnreadCount()
    } catch (error: any) {
      showToast('error', 'Không thể đánh dấu đã đọc')
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      await refreshUnreadCount()
      showToast('success', 'Đã đánh dấu tất cả đã đọc')
    } catch (error: any) {
      showToast('error', 'Không thể đánh dấu tất cả đã đọc')
    }
  }

  // Get navigation route based on notification type
  const getNavigationRoute = (notification: ClinicNotification): string | null => {
    switch (notification.type) {
      case 'CLINIC_PENDING_APPROVAL':
      case 'CLINIC_VERIFIED':
      case 'APPROVED':
      case 'REJECTED':
        return '/admin/clinics'
      default:
        return null
    }
  }

  // Handle notification click - mark as read and navigate
  const handleNotificationClick = async (notification: ClinicNotification) => {
    if (!notification.read) {
      await handleMarkAsRead(notification.notificationId)
    }
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
      case 'PENDING':
      case 'CLINIC_PENDING_APPROVAL':
        return 'bg-amber-100 border-amber-600'
      case 'CLINIC_VERIFIED':
        return 'bg-green-100 border-green-600'
      default:
        return 'bg-stone-100 border-stone-600'
    }
  }

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'APPROVED':
        return 'PHÒNG KHÁM ĐÃ ĐƯỢC DUYỆT'
      case 'REJECTED':
        return 'PHÒNG KHÁM BỊ TỪ CHỐI'
      case 'PENDING':
        return 'PHÒNG KHÁM CHỜ DUYỆT'
      case 'CLINIC_PENDING_APPROVAL':
        return 'PHÒNG KHÁM MỚI ĐĂNG KÝ'
      case 'CLINIC_VERIFIED':
        return 'PHÒNG KHÁM ĐÃ XÁC MINH'
      default:
        return 'THÔNG BÁO HỆ THỐNG'
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
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
      case 'PENDING':
        return (
          <div className="w-10 h-10 bg-amber-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
      case 'CLINIC_PENDING_APPROVAL':
        return (
          <div className="w-10 h-10 bg-blue-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )
      case 'CLINIC_VERIFIED':
        return (
          <div className="w-10 h-10 bg-green-500 border-2 border-stone-900 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            THÔNG BÁO HỆ THỐNG
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
                  {notification.clinicName && (
                    <p className="text-base font-bold text-black mb-2">
                      Phòng khám: <span className="uppercase">{notification.clinicName}</span>
                    </p>
                  )}
                  <p className="text-sm font-bold text-stone-700 mb-2">{notification.message}</p>
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
                    onClick={(e) => handleMarkAsRead(notification.notificationId, e)}
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
