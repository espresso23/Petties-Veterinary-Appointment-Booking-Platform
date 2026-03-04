import { useState, useRef, useEffect } from 'react'
import type { ChatToastMessage } from '../../store/chatToastStore'
import { useChatToastStore } from '../../store/chatToastStore'
import { chatService } from '../../services/api/chatService'
import { useChatStore } from '../../store/chatStore'
import { XMarkIcon, PaperAirplaneIcon, UserCircleIcon } from '@heroicons/react/24/solid'
import '../../styles/brutalist.css'

interface ChatToastItemProps {
    toast: ChatToastMessage
}

export const ChatToastItem = ({ toast }: ChatToastItemProps) => {
    const { removeToast, updateToastReply, setSendingReply } = useChatToastStore()
    const [isHovered, setIsHovered] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Auto-dismiss after 10s if not interacting
    useEffect(() => {
        if (toast.replyContent || isHovered) return

        const timer = setTimeout(() => {
            removeToast(toast.id)
        }, 10000)

        return () => clearTimeout(timer)
    }, [toast.id, toast.replyContent, isHovered, removeToast])

    const handleSendReply = async () => {
        if (!toast.replyContent?.trim()) return

        console.log('[ChatToastItem] Sending reply for toast:', toast)

        // Handle property mismatch from backend (chatBoxId vs conversationId)
        // @ts-ignore - Backend might send chatBoxId
        const targetId = toast.conversationId || toast.chatBoxId

        if (!targetId) {
            console.error('[ChatToastItem] Missing conversation ID', toast)
            return
        }

        setSendingReply(toast.id, true)
        try {
            await chatService.sendMessage(targetId, {
                content: toast.replyContent
            })

            // Mark conversation as read since we replied
            await chatService.markAsRead(targetId)

            // Manually refresh global unread count to update badge instantly
            useChatStore.getState().decrementUnreadCount()

            // Dismiss on success
            console.log('[ChatToastItem] Reply sent successfully')
            removeToast(toast.id)
        } catch (error) {
            console.error('[ChatToastItem] Failed to send quick reply:', error)
            setSendingReply(toast.id, false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendReply()
        }
    }

    return (
        <div
            className="w-[360px] bg-white border-2 border-stone-900 rounded-xl shadow-[6px_6px_0_#1c1917] flex flex-col transition-all duration-300 animate-slide-in-right overflow-hidden group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Header - Amber-400 for contrast */}
            <div className="bg-[#facc15] p-3 border-b-2 border-stone-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {toast.senderAvatar ? (
                        <img src={toast.senderAvatar} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-stone-900 object-cover bg-white" />
                    ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-stone-900 bg-white flex items-center justify-center">
                            <UserCircleIcon className="w-8 h-8 text-stone-900" />
                        </div>
                    )}
                    <div className="flex flex-col">
                        <span className="font-bold text-base leading-tight text-stone-900 line-clamp-1">{toast.senderName}</span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-700 bg-white/50 px-1.5 py-0.5 rounded-md self-start mt-0.5">Tin nhắn mới</span>
                    </div>
                </div>
                <button
                    onClick={() => removeToast(toast.id)}
                    className="w-8 h-8 flex items-center justify-center bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors shadow-[2px_2px_0_rgba(255,255,255,0.5)] active:translate-y-0.5 active:shadow-none"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>

            {/* Message Content */}
            <div className="p-4 bg-white max-h-[120px] overflow-y-auto">
                <p className="text-sm font-medium text-stone-700 break-words leading-relaxed">
                    {toast.messageType === 'IMAGE' ? (
                        <span className="italic flex items-center gap-1 text-stone-500">
                            📷 [Đã gửi một hình ảnh]
                        </span>
                    ) : (
                        toast.content
                    )}
                </p>
            </div>

            {/* Quick Reply Input */}
            <div className="p-3 bg-stone-50 border-t-2 border-stone-900 flex gap-2">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Trả lời nhanh..."
                    className="flex-1 bg-white border-2 border-stone-900 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-0 focus:shadow-[3px_3px_0_#1c1917] focus:-translate-y-0.5 transition-all placeholder:text-stone-400"
                    value={toast.replyContent || ''}
                    onChange={(e) => updateToastReply(toast.id, e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={toast.isSendingReply}
                />
                <button
                    onClick={handleSendReply}
                    disabled={!toast.replyContent?.trim() || toast.isSendingReply}
                    className="w-11 h-11 flex items-center justify-center bg-[#f97316] text-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#1c1917] active:translate-y-0 active:shadow-[2px_2px_0_#1c1917] disabled:opacity-50 disabled:pointer-events-none transition-all"
                    title="Gửi (Enter)"
                >
                    {toast.isSendingReply ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <PaperAirplaneIcon className="w-5 h-5 -rotate-45 translate-x-[-1px] translate-y-[1px]" />
                    )}
                </button>
            </div>
        </div>
    )
}
