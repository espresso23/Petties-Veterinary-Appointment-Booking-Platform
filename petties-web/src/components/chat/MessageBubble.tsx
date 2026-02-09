import { useState } from 'react'
import type { ChatMessage } from '../../types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  onImageClick?: (imageUrl: string) => void
}

/**
 * Image component with loading animation
 */
function LoadingImage({ src, alt, className, onClick }: {
  src: string
  alt: string
  className: string
  onClick?: () => void
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  return (
    <div className="relative">
      {/* Loading skeleton */}
      {isLoading && !hasError && (
        <div className={`${className} bg-stone-200 animate-pulse flex items-center justify-center absolute inset-0`}>
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-stone-500 font-medium">Đang tải...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className={`${className} bg-stone-100 flex items-center justify-center border-2 border-dashed border-stone-300 rounded-lg`}>
          <div className="flex flex-col items-center gap-1 text-stone-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs">Không tải được</span>
          </div>
        </div>
      )}

      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onClick={onClick}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
      />
    </div>
  )
}

/**
 * Uploading placeholder component - shown while image is being uploaded
 */
function UploadingPlaceholder({ className }: { className?: string }) {
  return (
    <div className={`${className || 'w-[220px] h-[180px]'} bg-stone-100 rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] flex items-center justify-center`}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-stone-600 font-medium">Đang tải lên...</span>
      </div>
    </div>
  )
}
/**
 * Message bubble component
 * Displays a single chat message with sender info and status
 */
export function MessageBubble({ message, onImageClick, myAvatar, partnerAvatar }: MessageBubbleProps & { myAvatar?: string, partnerAvatar?: string }) {
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

  const isMe = message.isMe

  // Choose avatar: prioritize passed prop. 
  // For 'isMe' (Clinic side), avoid fallback to message.senderAvatar because it might contain the Manager's avatar, which the user explicitly rejected.
  const avatarUrl = isMe
    ? myAvatar
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
            <LoadingImage
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
          {message.messageType === 'IMAGE' && (message.imageUrl || message.isUploading) ? (
            <div className={message.content ? "space-y-2" : ""}>
              {message.isUploading ? (
                <UploadingPlaceholder className="w-[220px] h-[180px]" />
              ) : (
                <LoadingImage
                  src={message.imageUrl!}
                  alt="Hình ảnh"
                  className="w-[220px] h-[180px] object-cover rounded-lg cursor-pointer transition-shadow"
                  onClick={() => handleImageClick(message.imageUrl!)}
                />
              )}
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
