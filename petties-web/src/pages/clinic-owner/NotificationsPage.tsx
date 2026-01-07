import { useState, useEffect } from 'react'
import { notificationService } from '../../services/api/notificationService'
import type { ClinicNotification } from '../../services/api/notificationService'
import { useToast } from '../../components/Toast'
import { useNotificationStore } from '../../store/notificationStore'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import '../../styles/brutalist.css'

/**
 * Clinic Owner Notifications Page - Neobrutalism Design
 * Shows clinic status notifications (approved/rejected)
 */
export const NotificationsPage = () => {
  const [notifications, setNotifications] = useState<ClinicNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const { showToast } = useToast()
  // Use Zustand store for unread count (synced with sidebar)
  const unreadCount = useNotificationStore((state) => state.unreadCount)
  const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)

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
      default:
        return 'bg-amber-100 border-amber-600'
    }
  }

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'APPROVED':
        return 'PHÒNG KHÁM ĐÃ ĐƯỢC DUYỆT'
      case 'REJECTED':
        return 'PHÒNG KHÁM KHÔNG ĐƯỢC DUYỆT'
      default:
        return 'THÔNG BÁO'
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
          <p className="text-stone-600 mt-1">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Tất cả đã đọc'}
          </p>
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
              className={`bg-white border-4 shadow-brutal p-6 transition-all hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0_#1c1917] ${notification.read ? 'border-stone-300' : 'border-stone-900'
                } ${getNotificationStyle(notification.type)}`}
            >
              <div className="flex items-start justify-between">
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
                  <p className="text-base font-bold text-black mb-2">
                    Phòng khám: <span className="uppercase">{notification.clinicName}</span>
                  </p>
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

