import type { ChatMessage } from '../../types/chat'

interface MessageBubbleProps {
  message: ChatMessage
}

/**
 * Message bubble component
 * Displays a single chat message with sender info and status
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isMe = message.isMe

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4`}>
      {/* Sender name */}
      <span className={`text-xs font-bold mb-1 px-1 ${isMe ? 'text-amber-700' : 'text-stone-600'}`}>
        {message.senderName}
      </span>

      {/* Message bubble */}
      <div
        className={`
          max-w-[75%] px-4 py-3 border-2 border-stone-900
          ${isMe 
            ? 'bg-amber-500 text-white rounded-l-xl rounded-tr-xl shadow-[3px_3px_0_#1c1917]' 
            : 'bg-white text-stone-900 rounded-r-xl rounded-tl-xl shadow-[3px_3px_0_#1c1917]'
          }
        `}
      >
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
      </div>

      {/* Timestamp and status */}
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[11px] text-stone-500 font-medium">
          {formatTime(message.createdAt)}
        </span>
        {isMe && message.status === 'SEEN' && (
          <span className="group relative">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            {/* Tooltip */}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-bold text-white bg-stone-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Đã xem
            </span>
          </span>
        )}
      </div>
    </div>
  )
}

export default MessageBubble
