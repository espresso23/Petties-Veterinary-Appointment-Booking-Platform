import { useRef, useEffect, useState } from 'react'
import { EllipsisVerticalIcon, PhotoIcon } from '@heroicons/react/24/outline'
import type { ChatMessage, ChatBox as ChatBoxType } from '../../types/chat'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'

interface ImageGroupProps {
  messages: ChatMessage[]
  onImageClick?: (imageUrl: string, groupMessages?: ChatMessage[]) => void
}

/**
 * Component for displaying grouped image messages like Messenger
 */
function ImageGroup({ messages, onImageClick }: ImageGroupProps) {
  const isMe = messages[0].isMe
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }

  const handleImageClick = (imageUrl: string, index: number) => {
    if (onImageClick) {
      onImageClick(imageUrl, messages)
    }
  }

  const handleGroupOverlayClick = () => {
    if (onImageClick && messages[0].imageUrl) {
      onImageClick(messages[0].imageUrl, messages)
    }
  }

  const getGridLayout = (count: number) => {
    if (count === 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-2'
    return 'grid-cols-2 grid-rows-2' // 3+ images
  }

  const getImageStyles = (index: number, total: number) => {
    if (total === 1) return 'col-span-1 row-span-1'
    if (total === 2) return 'col-span-1 row-span-1'
    // For 3 images: first spans 2 cols, others normal
    if (total >= 3) {
      if (index === 0) return 'col-span-2 row-span-1'
      return 'col-span-1 row-span-1'
    }
    return 'hidden'
  }

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4`}>
      {/* Sender name */}
      <span className={`text-xs font-bold mb-1 px-1 ${isMe ? 'text-amber-700' : 'text-stone-600'}`}>
        {messages[0].senderName}
      </span>

      {/* Image grid */}
      <div className="max-w-[280px]">
        <div className={`grid ${getGridLayout(messages.length)} gap-2`}>
          {messages.slice(0, 3).map((message, index) => (
            <div
              key={message.id}
              className={`relative ${getImageStyles(index, messages.length)}`}
            >
              <img
                src={message.imageUrl}
                alt={`Hình ảnh ${index + 1}`}
                className="w-full h-full object-cover rounded-lg border border-stone-900 shadow-[2px_2px_0_#1c1917] cursor-pointer hover:shadow-[3px_3px_0_#1c1917] transition-all"
                onClick={() => handleImageClick(message.imageUrl!, index)}
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
              {/* Overlay for 3rd image when there are more than 3 */}
              {index === 2 && messages.length > 3 && (
                <div 
                  className="absolute inset-0 bg-black bg-opacity-60 rounded-lg flex items-center justify-center cursor-pointer hover:bg-opacity-70 transition-all"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleGroupOverlayClick()
                  }}
                >
                  <span className="text-white font-bold text-lg">+1</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Timestamp */}
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[11px] text-stone-500 font-medium">
          {formatTime(messages[messages.length - 1].createdAt)}
        </span>
        {isMe && messages.some(msg => msg.status === 'SEEN') && (
          <span className="group relative">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-xs font-bold text-white bg-stone-800 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Đã xem
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
interface ChatBoxProps {
  chatBox: ChatBoxType
  messages: ChatMessage[]
  onSendMessage: (content: string) => void
  onImageUpload?: (file: File) => Promise<void>
  onCombinedMessage?: (content: string, imageFile: File) => Promise<void>
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
  onImageUpload,
  onCombinedMessage,
  onTyping,
  onLoadMore,
  loading = false,
  hasMore = false,
  isPartnerTyping = false,
}: ChatBoxProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showImageGallery, setShowImageGallery] = useState(false)
  const [galleryImages, setGalleryImages] = useState<any[]>([])
  const [galleryPage, setGalleryPage] = useState(0)
  const [galleryHasMore, setGalleryHasMore] = useState(false)
  const [galleryLoading, setGalleryLoading] = useState(false)
  const galleryImagesPerPage = 20

  // Image modal state (shared between single images and gallery)
  const [showImageModal, setShowImageModal] = useState(false)
  const [modalImages, setModalImages] = useState<ChatMessage[]>([])
  const [currentModalIndex, setCurrentModalIndex] = useState(0)

  // Get all images from messages
  const getConversationImages = () => {
    return messages
      .filter(message => message.messageType === 'IMAGE' && message.imageUrl)
      .map(message => ({
        url: message.imageUrl!,
        timestamp: message.createdAt,
        sender: message.senderName,
        id: message.id
      }))
      // Show newest first
  }

  // Load images for gallery with pagination
  const loadGalleryImages = (page = 0, append = false) => {
    const allImages = getConversationImages()
    const startIndex = page * galleryImagesPerPage
    const endIndex = startIndex + galleryImagesPerPage
    const pageImages = allImages.slice(startIndex, endIndex)

    if (append) {
      setGalleryImages(prev => [...prev, ...pageImages])
    } else {
      setGalleryImages(pageImages)
    }

    setGalleryHasMore(endIndex < allImages.length)
    setGalleryPage(page)
  }

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

  // Group consecutive image messages from same sender within 30 seconds
  const groupMessages = (messages: ChatMessage[]) => {
    const groups: (ChatMessage | ChatMessage[])[] = []
    let currentGroup: ChatMessage[] = []

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]

      if (message.messageType === 'IMAGE' && message.imageUrl) {
        // Check if we can add to current group
        if (currentGroup.length > 0) {
          const lastMessage = currentGroup[currentGroup.length - 1]
          const timeDiff = new Date(message.createdAt).getTime() - new Date(lastMessage.createdAt).getTime()
          const isSameSender = message.senderId === lastMessage.senderId
          const isWithinTimeWindow = timeDiff < 30000 // 30 seconds

          if (isSameSender && isWithinTimeWindow) {
            currentGroup.push(message)
            continue
          }
        }

        // Start new group or add single image
        if (currentGroup.length > 0) {
          groups.push(currentGroup)
          currentGroup = []
        }

        // Check if next messages can be grouped with this one
        const nextMessages = []
        for (let j = i + 1; j < messages.length; j++) {
          const nextMsg = messages[j]
          const timeDiff = new Date(nextMsg.createdAt).getTime() - new Date(message.createdAt).getTime()
          const isSameSender = nextMsg.senderId === message.senderId
          const isWithinTimeWindow = timeDiff < 30000
          const isImage = nextMsg.messageType === 'IMAGE' && nextMsg.imageUrl

          if (isImage && isSameSender && isWithinTimeWindow) {
            nextMessages.push(nextMsg)
            i = j // Skip these messages in main loop
          } else {
            break
          }
        }

        if (nextMessages.length > 0) {
          currentGroup = [message, ...nextMessages]
          groups.push(currentGroup)
          currentGroup = []
        } else {
          groups.push(message)
        }
      } else {
        // Non-image message
        if (currentGroup.length > 0) {
          groups.push(currentGroup)
          currentGroup = []
        }
        groups.push(message)
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup)
    }

    return groups
  }

  const groupedMessages = groupMessages(displayMessages)

  // Handle click on a single image message (not part of an ImageGroup)
  const handleSingleImageClick = (imageUrl: string) => {
    const imageMessages = displayMessages.filter(msg => msg.messageType === 'IMAGE' && msg.imageUrl)
    const idx = imageMessages.findIndex(img => img.imageUrl === imageUrl)
    if (idx === -1) return

    setModalImages(imageMessages)
    setCurrentModalIndex(idx)
    setShowImageModal(true)
  }

  // Handle click on image in ImageGroup
  const handleImageGroupClick = (imageUrl: string, groupMessages?: ChatMessage[]) => {
    // Always show counter in total conversation images
    const allImages = displayMessages.filter(msg => msg.messageType === 'IMAGE' && msg.imageUrl)
    const idx = allImages.findIndex(img => img.imageUrl === imageUrl)
    if (idx === -1) return

    setModalImages(allImages)
    setCurrentModalIndex(idx)
    setShowImageModal(true)
  }

  // Handle gallery image click to show modal
  const handleGalleryImageClick = (imageUrl: string) => {
    const imageMessages = displayMessages.filter(msg => msg.messageType === 'IMAGE' && msg.imageUrl)
    const idx = imageMessages.findIndex(img => img.imageUrl === imageUrl)
    if (idx === -1) return

    setModalImages(imageMessages)
    setCurrentModalIndex(idx)
    setShowImageModal(true)
  }

  // Handle gallery scroll for infinite loading
  const handleGalleryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    if (scrollTop + clientHeight >= scrollHeight - 100 && galleryHasMore && !galleryLoading) {
      setGalleryLoading(true)
      loadGalleryImages(galleryPage + 1, true)
      setGalleryLoading(false)
    }
  }

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
          <button
            onClick={() => {
              if (!showImageGallery) {
                loadGalleryImages(0, false)
              }
              setShowImageGallery(!showImageGallery)
            }}
            className="p-2 bg-white border-2 border-stone-900 rounded-lg font-bold shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
            title="Xem ảnh đã gửi"
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
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
          {groupedMessages.map((item, index) => {
            if (Array.isArray(item)) {
              // Image group
              return <ImageGroup key={`group-${index}`} messages={item} onImageClick={handleImageGroupClick} />
            } else {
              // Single message
              return <MessageBubble key={item.id} message={item} onImageClick={handleSingleImageClick} />
            }
          })}

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
      <MessageInput onSend={onSendMessage} onImageUpload={onImageUpload} onCombinedMessage={onCombinedMessage} onTyping={onTyping} />

      {/* Image Gallery Sidebar */}
      {showImageGallery && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white border-l-2 border-stone-900 shadow-[-4px_0_8px_rgba(0,0,0,0.1)] z-50 transform transition-transform duration-300 ease-in-out">
          {/* Header */}
          <div className="p-6 border-b-2 border-stone-900 bg-stone-50">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-stone-900">
                Ảnh đã gửi
              </h3>
              <button
                onClick={() => setShowImageGallery(false)}
                className="p-2 bg-stone-900 text-white border-2 border-stone-900 rounded-lg font-bold shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div
            className="p-6 overflow-y-auto h-full pb-24"
            onScroll={handleGalleryScroll}
          >
            {galleryImages.length === 0 ? (
              <div className="text-center py-12">
                <PhotoIcon className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <p className="text-lg font-bold text-stone-500">
                  Chưa có file nào được gửi
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {galleryImages.map((image, index) => (
                  <div key={`${image.id}-${index}`} className="group relative">
                    <img
                      src={image.url}
                      alt={`Ảnh ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg transition-all cursor-pointer"
                      onClick={() => handleGalleryImageClick(image.url)}
                    />
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                      {new Date(image.timestamp).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                ))}
                {galleryLoading && (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600"></div>
                    <p className="text-sm text-stone-500 mt-2">Đang tải thêm...</p>
                  </div>
                )}
                {!galleryHasMore && galleryImages.length > 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-stone-500">Đã tải hết ảnh</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && modalImages.length > 0 && (
        <>
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="relative max-w-4xl max-h-full flex items-center">
              {/* Previous button */}
              {modalImages.length > 1 && currentModalIndex > 0 && (
                <button
                  onClick={() => {
                    const newIndex = currentModalIndex - 1
                    setCurrentModalIndex(newIndex)
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-75 transition-all z-10"
                >
                  ‹
                </button>
              )}

              <img
                src={modalImages[currentModalIndex].imageUrl}
                alt={`Hình ảnh ${currentModalIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />

              {/* Next button */}
              {modalImages.length > 1 && currentModalIndex < modalImages.length - 1 && (
                <button
                  onClick={() => {
                    const newIndex = currentModalIndex + 1
                    setCurrentModalIndex(newIndex)
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-75 transition-all z-10"
                >
                  ›
                </button>
              )}

              {/* Close button */}
              <button
                onClick={() => setShowImageModal(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-black bg-opacity-50 text-white rounded-full flex items-center justify-center hover:bg-opacity-75 transition-all"
              >
                ✕
              </button>

              {/* Image counter */}
              {modalImages.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                  {currentModalIndex + 1} / {modalImages.length}
                </div>
              )}
            </div>
          </div>
          <div className="fixed inset-0 z-40" onClick={() => setShowImageModal(false)} />
        </>
      )}
    </div>
  )
}

export default ChatBox
