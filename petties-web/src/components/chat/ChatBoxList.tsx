import type { ChatBox } from '../../types/chat'

interface ChatBoxListProps {
  chatBoxes: ChatBox[]
  selectedId: string | null
  onSelect: (chatBox: ChatBox) => void
  loading?: boolean
}

/**
 * Chat box list component for chat sidebar
 * Displays list of chat boxes with Pet Owners
 */
export function ChatBoxList({
  chatBoxes,
  selectedId,
  onSelect,
  loading = false,
}: ChatBoxListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    )
  }

  if (chatBoxes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-4 border-2 border-stone-900">
          <svg
            className="w-8 h-8 text-stone-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>
        <p className="text-stone-500 font-medium">Chưa có tin nhắn nào</p>
        <p className="text-stone-400 text-sm mt-1">
          Khi khách hàng nhắn tin, cuộc hội thoại sẽ hiển thị ở đây
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {chatBoxes.map((chatBox) => (
        <ChatBoxItem
          key={chatBox.id}
          chatBox={chatBox}
          isActive={selectedId === chatBox.id}
          onClick={() => onSelect(chatBox)}
        />
      ))}
    </div>
  )
}

interface ChatBoxItemProps {
  chatBox: ChatBox
  isActive: boolean
  onClick: () => void
}

function ChatBoxItem({ chatBox, isActive, onClick }: ChatBoxItemProps) {
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return ''
    // Ensure UTC interpretation if 'Z' or offset is missing
    const date = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Hôm qua'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('vi-VN', { weekday: 'short' })
    } else {
      return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    }
  }

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-stone-200
        ${isActive
          ? 'bg-amber-50 border-l-4 border-l-amber-600'
          : 'hover:bg-amber-50/50 border-l-4 border-l-transparent'
        }
      `}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {chatBox.petOwnerAvatar ? (
          <img
            src={chatBox.petOwnerAvatar}
            alt={chatBox.petOwnerName}
            className="w-12 h-12 rounded-full border-2 border-stone-900 object-cover bg-white"
          />
        ) : (
          <div className="w-12 h-12 rounded-full border-2 border-stone-900 bg-amber-100 flex items-center justify-center">
            <span className="text-amber-700 font-bold text-lg">
              {chatBox.petOwnerName?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}
        {chatBox.partnerOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <h3
            className={`text-sm font-bold truncate ${isActive ? 'text-amber-700' : 'text-stone-900'}`}
          >
            {chatBox.petOwnerName || 'Khách hàng'}
          </h3>
          <span className="text-xs text-stone-500 flex-shrink-0 ml-2">
            {formatTime(chatBox.lastMessageAt)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-stone-600 truncate pr-2">
            {chatBox.lastMessageSender === 'CLINIC' && (
              <span className="text-stone-400">Bạn: </span>
            )}
            {chatBox.lastMessage || 'Chưa có tin nhắn'}
          </p>
          {chatBox.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {chatBox.unreadCount > 99 ? '99+' : chatBox.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatBoxList
