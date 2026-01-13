import { useState } from 'react'
import type { ChatMessage } from '../../types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  onImageClick?: (imageUrl: string) => void
}

/**
 * Message bubble component
 * Displays a single chat message with sender info and status
 */
export function MessageBubble({ message, onImageClick }: MessageBubbleProps) {
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

  const isMe = message.isMe

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  const handleImageClick = (imageUrl: string) => {
    try {
      console.debug('MessageBubble.handleImageClick', { imageUrl, messageId: message.id })

      if (onImageClick) {
        onImageClick(imageUrl)
        return
      }

      setSelectedImageUrl(imageUrl)
      setShowImageModal(true)
    } catch (err) {
      console.error('Error in MessageBubble.handleImageClick', err, { imageUrl, messageId: message.id })
    }
  }

  // Image Modal (local fallback)
  if (showImageModal && selectedImageUrl) {
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImageUrl}
              alt="Hình ảnh phóng to"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-75 transition-all"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="fixed inset-0 z-40" onClick={() => setShowImageModal(false)} />
      </>
    )
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
          max-w-[75%] ${message.messageType === 'IMAGE' ? '' : 'px-4 py-3'} border-2 border-stone-900
          ${isMe
            ? 'bg-amber-500 text-white rounded-l-xl rounded-tr-xl shadow-[3px_3px_0_#1c1917]'
            : 'bg-white text-stone-900 rounded-r-xl rounded-tl-xl shadow-[3px_3px_0_#1c1917]'
          }
        `}
      >
        {message.messageType === 'IMAGE' && message.imageUrl ? (
          <div className={message.content ? "space-y-2" : ""}>
            <img
              src={message.imageUrl}
              alt="Hình ảnh"
              className="w-auto max-w-[280px] max-h-[280px] h-auto rounded-lg cursor-pointer transition-shadow"
              onClick={() => handleImageClick(message.imageUrl!)}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement
                if (img.naturalWidth === 0) {
                  console.error('Image failed to load:', message.imageUrl)
                }
              }}
              onError={(e) => {
                console.error('Image failed to load:', message.imageUrl)
                const img = e.target as HTMLImageElement
                img.style.display = 'none'
              }}
            />
            {message.content && (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </div>
        ) : message.messageType === 'IMAGE_TEXT' && message.imageUrl ? (
          <div className="space-y-2">
            <img
              src={message.imageUrl}
              alt="Hình ảnh"
              className="w-auto max-w-[280px] max-h-[280px] h-auto rounded-lg cursor-pointer transition-shadow"
              onClick={() => handleImageClick(message.imageUrl!)}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement
                if (img.naturalWidth === 0) {
                  console.error('Image failed to load:', message.imageUrl)
                }
              }}
              onError={(e) => {
                console.error('Image failed to load:', message.imageUrl)
                const img = e.target as HTMLImageElement
                img.style.display = 'none'
              }}
            />
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        ) : (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        )}
      </div>

      {/* Timestamp and status */}
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[11px] text-stone-500 font-medium">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  )
}
