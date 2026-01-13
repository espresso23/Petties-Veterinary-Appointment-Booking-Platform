import { useRef, useEffect } from 'react'
import type { ChatMessage, ChatBox as ChatBoxType } from '../../types/chat'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'

interface ChatBoxProps {
  chatBox: ChatBoxType
  messages: ChatMessage[]
  onSendMessage: (content: string) => void
  onTyping?: (typing: boolean) => void
  onLoadMore?: () => void
  loading?: boolean
  hasMore?: boolean
  isPartnerTyping?: boolean
}

/**
 * Chat box component displaying messages and input
 */
export function ChatBox({
  chatBox,
  messages,
  onSendMessage,
  onTyping,
  onLoadMore,
  loading = false,
  hasMore = false,
  isPartnerTyping = false,
}: ChatBoxProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated
    const timer = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [messages])

  // Handle scroll for infinite loading
  const handleScroll = () => {
    if (!messagesContainerRef.current || loading || !hasMore) return

    const { scrollTop } = messagesContainerRef.current
    if (scrollTop === 0 && onLoadMore) {
      onLoadMore()
    }
  }

  // Messages from API are DESC (newest first), reverse for display (oldest first, newest at bottom)
  // Filter duplicates by ID to prevent duplicate key warning
  const uniqueMessages = messages.filter(
    (msg, index, self) => index === self.findIndex((m) => m.id === msg.id)
  )
  const displayMessages = [...uniqueMessages].reverse()

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Chat Header */}
      <header className="h-20 px-6 border-b-2 border-stone-900 flex items-center justify-between bg-white z-10">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            {chatBox.petOwnerAvatar ? (
              <img
                src={chatBox.petOwnerAvatar}
                alt={chatBox.petOwnerName}
                className="w-12 h-12 rounded-full border-2 border-stone-900 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full border-2 border-stone-900 bg-amber-100 flex items-center justify-center">
                <span className="text-amber-700 font-bold text-lg">
                  {chatBox.petOwnerName?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
            {chatBox.partnerOnline && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
            )}
          </div>

          {/* Name and status */}
          <div>
            <h2 className="text-lg font-bold text-stone-900">
              {chatBox.petOwnerName || 'Khách hàng'}
            </h2>
            <p className="text-sm text-stone-500 font-medium flex items-center gap-2">
              {isPartnerTyping ? (
                <span className="text-amber-600">Đang nhập...</span>
              ) : chatBox.partnerOnline ? (
                <span className="text-green-600">Đang hoạt động</span>
              ) : (
                <span>Không trực tuyến</span>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border-2 border-stone-900 rounded-lg text-sm font-bold shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
            Xem hồ sơ
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 bg-stone-50"
      >
        <div className="w-full">
          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center mb-6">
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="text-sm text-amber-600 font-bold hover:underline disabled:opacity-50"
              >
                {loading ? 'Đang tải...' : 'Tải thêm tin nhắn cũ'}
              </button>
            </div>
          )}

          {/* Messages */}
          {displayMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Typing indicator */}
          {isPartnerTyping && (
            <div className="flex items-center gap-2 mb-4 ml-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <MessageInput onSend={onSendMessage} onTyping={onTyping} />
    </div>
  )
}

export default ChatBox
