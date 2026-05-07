import { useEffect, useState } from 'react'
import {
  ChatBubbleLeftRightIcon,
  TrashIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { useAIChatStore } from '../../store/aiChatStore'
import type { ChatSession } from '../../store/aiChatStore'
import { useAuthStore } from '../../store/authStore'
import { env } from '../../config/env'
import { ConfirmModal } from '../ConfirmModal'
import { useToast } from '../Toast'

interface SessionSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => Promise<void>
  currentSessionId: string | null
}

export const SessionSidebar = ({
  isOpen,
  onClose,
  onSelectSession,
  onDeleteSession,
  currentSessionId,
}: SessionSidebarProps) => {
  const { showToast } = useToast()
  const accessToken = useAuthStore((state) => state.accessToken)
  const sessions = useAIChatStore((state) => state.sessions)
  const setSessions = useAIChatStore((state) => state.setSessions)
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null)

  const loadSessions = async () => {
    if (!accessToken) return

    try {
      setLoading(true)
      const baseUrl = env.AGENT_API_BASE_URL
      const response = await fetch(`${baseUrl}/api/v1/chat/sessions?limit=20&context_type=BUSINESS_CHAT`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const mappedSessions: ChatSession[] = (data.sessions || []).map((s: any) => ({
          sessionId: s.session_id,
          title: s.title || s.first_message_preview || 'Cuộc trò chuyện mới',
          contextType: s.context_type,
          userRole: s.user_role,
          clinicId: s.clinic_id,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          messageCount: s.message_count,
        }))
        setSessions(mappedSessions)
      }
    } catch (error) {
      console.error('[SessionSidebar] Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && sessions.length === 0) {
      loadSessions()
    }
  }, [isOpen])

  const handleDeleteSession = async () => {
    if (!deleteTarget) return

    try {
      await onDeleteSession(deleteTarget.sessionId)
      setSessions(sessions.filter((s) => s.sessionId !== deleteTarget.sessionId))
      showToast('success', 'Đã xóa cuộc trò chuyện')
    } catch (error) {
      console.error('[SessionSidebar] Failed to delete session:', error)
      showToast('error', 'Không thể xóa cuộc trò chuyện')
    } finally {
      setDeleteTarget(null)
    }
  }

  const formatTimeAgo = (dateString?: string): string => {
    if (!dateString) return 'Không rõ'

    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Vừa xong'
    if (diffMins < 60) return `${diffMins} phút trước`
    if (diffHours < 24) return `${diffHours} giờ trước`
    if (diffDays < 7) return `${diffDays} ngày trước`

    return date.toLocaleDateString('vi-VN')
  }

  if (!isOpen) return null

  return (
    <>
      <div className="absolute inset-0 z-20 flex flex-col bg-white">
        {/* Header */}
        <div className="border-b-2 border-stone-900 bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-stone-300 p-1.5 text-stone-600 hover:bg-stone-100"
                title="Quay lại chat"
                aria-label="Quay lại chat"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-black text-stone-900">LỊCH SỬ CHAT</p>
                <p className="text-[11px] font-semibold text-stone-500">
                  {sessions.length} cuộc trò chuyện
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto bg-white p-2">
          {loading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-stone-500">
              <SparklesIcon className="h-5 w-5 animate-pulse mr-2" />
              Đang tải lịch sử...
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-xs text-stone-500">
              Chưa có cuộc trò chuyện nào.
              <br />
              Bắt đầu chat để tạo phiên mới.
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => {
                const isActive = session.sessionId === currentSessionId

                return (
                  <div
                    key={session.sessionId}
                    className={`group relative flex items-start gap-3 rounded-lg border-2 p-3 transition-all ${
                      isActive
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                        isActive
                          ? 'border-amber-600 bg-amber-500 text-white'
                          : 'border-stone-300 bg-stone-100 text-stone-500'
                      }`}>
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Content */}
                    <button
                      type="button"
                      onClick={() => onSelectSession(session.sessionId)}
                      className="flex-1 text-left"
                    >
                      <p className={`text-xs font-bold line-clamp-1 ${
                        isActive ? 'text-amber-700' : 'text-stone-900'
                      }`}>
                        {session.title || 'Cuộc trò chuyện mới'}
                      </p>
                      <p className="mt-1 text-[10px] font-semibold text-stone-500">
                        {formatTimeAgo(session.updatedAt || session.createdAt)}
                        {session.messageCount != null && session.messageCount > 0 && (
                          <span className="ml-2">• {session.messageCount} tin nhắn</span>
                        )}
                      </p>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTarget(session)
                      }}
                      className="flex-shrink-0 rounded-md border border-stone-300 p-1 text-stone-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                      title="Xóa cuộc trò chuyện này"
                      aria-label="Xóa cuộc trò chuyện này"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Xóa cuộc trò chuyện"
        message={`Bạn có chắc muốn xóa "${deleteTarget?.title || 'cuộc trò chuyện này'}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSession}
      />
    </>
  )
}

export default SessionSidebar
