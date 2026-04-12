import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  CheckCircleIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  XMarkIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import type { AISessionMessage } from '../../store/aiChatStore'
import { useAIChatStore } from '../../store/aiChatStore'
import type { UIAction, UIComponent } from '../../types/chat-copilot'
import { UISchemaRenderer } from '../chat/renderers/UISchemaRenderer'
import { ConfirmModal } from '../ConfirmModal'

interface MascotDockPanelProps {
  isOpen: boolean
  onClose: () => void
  onSendMessage: (message: string, context?: Record<string, unknown>) => Promise<unknown>
  onSendUiAction: (action: UIAction, displayMessage?: string) => Promise<void>
  onDeleteConversation?: () => Promise<void>
  messages: AISessionMessage[]
  connectionStatus: 'disconnected' | 'connecting' | 'connected'
  routePath: string
  bookingAlert?: {
    bookingId: string
    bookingCode?: string
  } | null
  onViewBookingDetail?: (bookingId: string) => void
}

interface QuickAction {
  key: string
  label: string
  prompt: string
}

interface PendingConfirmAction {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  action: UIAction
}

const QUICK_ACTIONS_BY_ROUTE: Array<{ match: RegExp; actions: QuickAction[] }> = [
  {
    match: /^\/staff\//,
    actions: [
      { key: 'staff_summary', label: 'Tóm tắt công việc hôm nay', prompt: 'Tóm tắt lịch làm việc và lịch hẹn hôm nay cho tôi.' },
      { key: 'staff_tasks', label: 'Liệt kê việc cần xử lý', prompt: 'Hãy liệt kê các việc cần ưu tiên xử lý trong ca hôm nay.' },
      { key: 'staff_patients', label: 'Tổng hợp bệnh nhân cần lưu ý', prompt: 'Tổng hợp các bệnh nhân cần theo dõi đặc biệt hôm nay.' },
    ],
  },
  {
    match: /^\/clinic-manager\//,
    actions: [
      { key: 'manager_bookings', label: 'Bookings chờ xử lý', prompt: 'Cho tôi danh sách booking đang chờ xác nhận và gợi ý ưu tiên.' },
      { key: 'manager_shift', label: 'Kiểm tra lịch nhân sự', prompt: 'Kiểm tra lịch nhân sự hôm nay và cảnh báo nếu thiếu ca.' },
      { key: 'manager_actions', label: 'Tìm action items', prompt: 'Tóm tắt các action items vận hành quan trọng trong hôm nay.' },
    ],
  },
  {
    match: /^\/clinic-owner\//,
    actions: [
      { key: 'owner_revenue', label: 'Tóm tắt doanh thu', prompt: 'Tóm tắt doanh thu gần đây và điểm cần chú ý của phòng khám.' },
      { key: 'owner_services', label: 'Phân tích dịch vụ', prompt: 'Phân tích dịch vụ hiệu quả và đề xuất dịch vụ cần cải thiện.' },
      { key: 'owner_tasks', label: 'Tổng hợp đầu việc', prompt: 'Liệt kê các đầu việc quản trị cần ưu tiên trong tuần này.' },
    ],
  },
]

const FALLBACK_ACTIONS: QuickAction[] = [
  { key: 'summary', label: 'Tóm tắt trang hiện tại', prompt: 'Tóm tắt nội dung chính của trang hiện tại cho tôi.' },
  { key: 'action_items', label: 'Tìm action items', prompt: 'Trích xuất các action items quan trọng từ ngữ cảnh hiện tại.' },
  { key: 'translate', label: 'Dịch nội dung', prompt: 'Dịch nội dung hiện tại sang tiếng Việt rõ ràng, dễ đọc.' },
]

export const MascotDockPanel = ({
  isOpen,
  onClose,
  onSendMessage,
  onSendUiAction,
  onDeleteConversation,
  messages,
  connectionStatus,
  routePath,
  bookingAlert,
  onViewBookingDetail,
}: MascotDockPanelProps) => {
  const [inputValue, setInputValue] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedClinic = useAIChatStore((state) => state.selectedClinic)

  const quickActions = useMemo(() => {
    const matched = QUICK_ACTIONS_BY_ROUTE.find((item) => item.match.test(routePath))
    return matched?.actions || FALLBACK_ACTIONS
  }, [routePath])

  // Filter clinic cards from messages if a clinic is already selected
  const filteredMessages = useMemo(() => {
    if (!selectedClinic?.clinicId) return messages

    return messages.map((message) => {
      if (!message.uiSchema) return message

      // Filter out clinic_card components that are not the selected clinic
      const filteredComponents = message.uiSchema.components.filter((component) => {
        if (component.type !== 'clinic_card') return true
        
        // Keep only the selected clinic card or if it's marked as "selected"
        const componentClinicId = component.data['clinic_id'] ?? component.data['clinicId'] ?? component.data['id']
        return componentClinicId === selectedClinic.clinicId
      })

      // If all components were clinic cards and none match, show a simple message
      if (filteredComponents.length === 0 && message.uiSchema.components.some((c) => c.type === 'clinic_card')) {
        return {
          ...message,
          uiSchema: {
            ...message.uiSchema,
            components: [{
              type: 'badge' as const,
              id: `selected-clinic-badge-${selectedClinic.clinicId}`,
              data: { content: `Đang làm việc với: ${selectedClinic.clinicName || 'Phòng khám đã chọn'}` },
              actions: [],
            }],
          },
        }
      }

      return {
        ...message,
        uiSchema: {
          ...message.uiSchema,
          components: filteredComponents,
        },
      }
    })
  }, [messages, selectedClinic])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isOpen, messages])

  if (!isOpen) return null

  const sendMessage = async (message: string, quickAction?: string) => {
    const clean = message.trim()
    if (!clean) return

    await onSendMessage(clean, {
      route_path: routePath,
      quick_action: quickAction,
      ui_mode: 'docked_panel',
    })

    setInputValue('')
  }

  const extractDisplayMessage = (action: UIAction): string | undefined => {
    const payload = (action.payload || {}) as Record<string, unknown>
    if (typeof payload.display_message === 'string') {
      return payload.display_message
    }

    const directDisplay = (action as unknown as { display_message?: unknown }).display_message
    if (typeof directDisplay === 'string') {
      return directDisplay
    }

    return undefined
  }

  const handleUiAction = async (action: UIAction) => {
    if (action.type === 'open_native_confirm') {
      const payload = (action.payload || {}) as Record<string, unknown>
      const confirmAction = payload.confirm_action as UIAction | undefined
      if (!confirmAction) {
        return
      }

      setPendingConfirm({
        title: String(payload.title || 'Xác nhận thao tác'),
        message: String(payload.message || 'Bạn có chắc muốn tiếp tục thao tác này không?'),
        confirmLabel: String(payload.confirm_label || 'Xác nhận'),
        cancelLabel: String(payload.cancel_label || 'Hủy'),
        action: confirmAction,
      })
      return
    }

    // If selecting a clinic, update the store state
    if (action.type === 'select_item') {
      const payload = (action.payload || {}) as Record<string, unknown>
      const clinicId = (payload.clinic_id ?? payload.clinicId ?? payload.id) as string | undefined
      const clinicName = (payload.clinic_name ?? payload.clinicName ?? payload.name) as string | undefined
      
      if (clinicId) {
        useAIChatStore.getState().setSelectedClinic({ clinicId, clinicName })
      }
    }

    await onSendUiAction(action, extractDisplayMessage(action))
  }

  const handleDeleteConversation = async () => {
    if (onDeleteConversation) {
      await onDeleteConversation()
    }
    setShowDeleteConfirm(false)
  }

  const isBusy = connectionStatus === 'connecting'
  const canSend = connectionStatus === 'connected' && inputValue.trim().length > 0

  return (
    <aside
      className={[
        'fixed right-5 z-40 overflow-hidden border-2 border-stone-900 bg-white',
        'shadow-[4px_4px_0_#1c1917] transition-all duration-300',
        isExpanded ? 'bottom-5 top-5 w-[420px]' : 'bottom-5 h-[620px] w-[370px]',
      ].join(' ')}
      aria-label="Bảng trợ lý Petties"
    >
      <div className="flex h-full flex-col">
        <header className="border-b-2 border-stone-900 bg-stone-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-500 text-white">
                <SparklesIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-black text-stone-900">Trợ lý Petties</p>
                <p className="text-[11px] font-semibold text-stone-500">
                  {connectionStatus === 'connected' ? 'Đã kết nối' : connectionStatus === 'connecting' ? 'Đang kết nối...' : 'Mất kết nối'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                className="rounded-md border border-stone-300 p-1 text-stone-600 hover:bg-stone-100"
                title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
                aria-label={isExpanded ? 'Thu nhỏ bảng trợ lý' : 'Mở rộng bảng trợ lý'}
              >
                {isExpanded ? <ArrowsPointingInIcon className="h-4 w-4" /> : <ArrowsPointingOutIcon className="h-4 w-4" />}
              </button>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-md border border-stone-300 p-1 text-stone-600 hover:bg-red-50 hover:text-red-600"
                  title="Xóa lịch sử chat"
                  aria-label="Xóa lịch sử chat"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-stone-300 p-1 text-stone-600 hover:bg-stone-100"
                title="Đóng"
                aria-label="Đóng bảng trợ lý"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <section className="border-b border-stone-200 bg-stone-50 px-3 py-3">
          {bookingAlert && (
            <div className="mb-3 rounded-md border-2 border-stone-900 bg-amber-100 p-3">
              <p className="text-[11px] font-bold uppercase text-stone-700">Booking mới được giao</p>
              <p className="mt-1 text-xs font-semibold text-stone-800">
                {bookingAlert.bookingCode
                  ? `Bạn vừa nhận booking #${bookingAlert.bookingCode}.`
                  : 'Bạn vừa nhận một booking mới cần xử lý.'}
              </p>
              <button
                type="button"
                onClick={() => onViewBookingDetail?.(bookingAlert.bookingId)}
                className="mt-2 inline-flex items-center gap-2 rounded-md border-2 border-stone-900 bg-white px-3 py-1.5 text-[11px] font-bold uppercase text-stone-900 shadow-[2px_2px_0_#1c1917] hover:bg-amber-50"
              >
                Xem chi tiết booking
              </button>
            </div>
          )}

          <p className="mb-2 text-[11px] font-bold uppercase text-stone-500">Hôm nay tôi có thể giúp gì?</p>
          <div className="grid grid-cols-1 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.key}
                type="button"
                className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-left text-xs font-semibold text-stone-700 hover:bg-amber-50"
                onClick={() => void sendMessage(action.prompt, action.key)}
                disabled={connectionStatus !== 'connected'}
              >
                <CheckCircleIcon className="h-4 w-4 text-amber-600" />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-white px-3 py-3">
          {messages.length === 0 && (
            <div className="rounded-md border border-dashed border-stone-300 bg-stone-50 p-3 text-xs text-stone-500">
              Bắt đầu bằng cách chọn một gợi ý hoặc nhập câu hỏi ở phía dưới.
            </div>
          )}

          {filteredMessages.map((message) => (
            <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={[
                  'max-w-[88%] rounded-lg border px-3 py-2 text-sm',
                  message.role === 'user'
                    ? 'border-stone-900 bg-stone-900 text-white'
                    : 'border-stone-300 bg-stone-50 text-stone-800',
                ].join(' ')}
              >
                {message.isLoading && !message.uiSchema && !message.content.trim() ? (
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <SparklesIcon className="h-4 w-4 animate-pulse" />
                    <span>Đang xử lý...</span>
                  </div>
                ) : (
                  <>
                    {message.content.trim() && (
                      <p className="whitespace-pre-wrap text-xs leading-5">{message.content}</p>
                    )}

                    {message.uiSchema && (
                      <div className={message.content.trim() ? 'mt-3' : ''}>
                        <UISchemaRenderer
                          schema={message.uiSchema}
                          onAction={(action: UIAction, component: UIComponent) => {
                            void component
                            void handleUiAction(action)
                          }}
                          selectedClinicId={selectedClinic?.clinicId}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </section>

        <footer className="border-t-2 border-stone-900 bg-white px-3 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Nhập yêu cầu cho trợ lý Petties..."
              rows={2}
              className="max-h-28 min-h-[44px] flex-1 resize-y rounded-md border-2 border-stone-900 px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              type="button"
              onClick={() => void sendMessage(inputValue)}
              disabled={!canSend || isBusy}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border-2 border-stone-900 bg-amber-500 text-white shadow-[2px_2px_0_#1c1917] transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Gửi yêu cầu"
              title="Gửi yêu cầu"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
            </button>
          </div>
        </footer>
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || 'Xác nhận thao tác'}
        message={pendingConfirm?.message || 'Bạn có chắc muốn tiếp tục?'}
        confirmLabel={pendingConfirm?.confirmLabel || 'Xác nhận'}
        cancelLabel={pendingConfirm?.cancelLabel || 'Hủy'}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (!pendingConfirm) return
          const action = pendingConfirm.action
          const displayMessage = extractDisplayMessage(action)
          setPendingConfirm(null)
          void onSendUiAction(action, displayMessage)
        }}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Xóa lịch sử chat"
        message="Bạn có chắc muốn xóa toàn bộ lịch sử trò chuyện? Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConversation}
      />
    </aside>
  )
}

export default MascotDockPanel
