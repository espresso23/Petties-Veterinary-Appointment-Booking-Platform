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
export function MessageBubble({ message, onImageClick, myAvatar, partnerAvatar }: MessageBubbleProps & { myAvatar?: string, partnerAvatar?: string }) {
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

  const isMe = message.isMe

  // Choose avatar: prioritize passed prop (current), fallback to message (historical), fallback to placeholder
  const avatarUrl = isMe
    ? (myAvatar || message.senderAvatar)
    : (partnerAvatar || message.senderAvatar)

  // Default placeholder if no avatar
  const renderAvatar = () => (
    <div className="flex-shrink-0 mb-6">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={isMe ? "Tôi" : message.senderName}
          className="w-8 h-8 rounded-full object-cover border border-stone-200"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center border border-stone-300">
          <span className="text-xs font-bold text-stone-500">
            {message.senderName?.charAt(0).toUpperCase() || (isMe ? 'T' : 'K')}
          </span>
        </div>
      )}
    </div>
  )

  const formatTime = (dateStr: string) => {
    // Ensure UTC interpretation if 'Z' or offset is missing
    const date = new Date(dateStr.endsWith('Z') ? dateStr : `${dateStr}Z`)
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

  // Image Modal (local fallback) - same as before
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

  // Common container classes - Added items-end for Messenger style alignment
  const containerClass = `flex gap-2 mb-4 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end`

  // Special rendering for IMAGE_TEXT
  if (message.messageType === 'IMAGE_TEXT' && message.imageUrl) {
    return (
      <div className={containerClass}>
        {renderAvatar()}
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
          <span className={`text-xs font-bold mb-1 px-1 ${isMe ? 'text-amber-700' : 'text-stone-600'}`}>
            {message.senderName}
          </span>

          {/* Image */}
          <div className="mb-2">
            <img
              src={message.imageUrl}
              alt="Hình ảnh"
              className="w-[220px] h-[180px] object-cover rounded-lg cursor-pointer transition-shadow border-2 border-stone-900 shadow-[3px_3px_0_#1c1917]"
              onClick={() => handleImageClick(message.imageUrl!)}
            />
          </div>

          {/* Text */}
          {message.content && (
            <p className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${isMe ? 'text-stone-700' : 'text-stone-700'}`}>
              {message.content}
            </p>
          )}

          {/* Time */}
          <div className="flex items-center gap-1 mt-1 px-1">
            <span className="text-[11px] text-stone-500 font-medium">
              {formatTime(message.createdAt)}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClass}>
      {renderAvatar()}
      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {/* Sender name */}
        <span className={`text-xs font-bold mb-1 px-1 ${isMe ? 'text-amber-700' : 'text-stone-600'}`}>
          {message.senderName}
        </span>

        {/* Message bubble */}
        <div
          className={`
            w-full ${message.messageType === 'IMAGE' ? '' : 'px-4 py-3'} border-2 border-stone-900
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
                className="w-[220px] h-[180px] object-cover rounded-lg cursor-pointer transition-shadow"
                onClick={() => handleImageClick(message.imageUrl!)}
              />
              {message.content && (
                <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center gap-1 mt-1 px-1">
          <span className="text-[11px] text-stone-500 font-medium">
            {formatTime(message.createdAt)}
          </span>
        </div>
      </div>
    </div>
  )
}
