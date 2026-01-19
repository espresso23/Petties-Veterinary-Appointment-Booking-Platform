import { useState, useEffect, useCallback, useRef } from 'react'
import { MagnifyingGlassIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { ChatBoxList, ChatBox } from '../../components/chat'
import { chatService } from '../../services/api/chatService'
import { chatWebSocket } from '../../services/websocket/chatWebSocket'
import { useToast } from '../../hooks/useToast'
import { useChatStore } from '../../store/chatStore'
import type { ChatBox as ChatBoxType, ChatMessage, ChatWebSocketMessage } from '../../types/chat'

/**
 * Chat Page for Clinic Manager
 * Displays chat boxes with Pet Owners and allows messaging
 */
export function ChatPage() {
  const { showToast } = useToast()
  // incrementUnreadCount removed - handled by layout subscription
  const decrementChatUnreadCount = useChatStore((state) => state.decrementUnreadCount)
  const refreshChatUnreadCount = useChatStore((state) => state.refreshUnreadCount)

  // State
  const [chatBoxes, setChatBoxes] = useState<ChatBoxType[]>([])
  const [selectedChatBox, setSelectedChatBox] = useState<ChatBoxType | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isPartnerTyping, setIsPartnerTyping] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)

  // Loading states
  const [loadingChatBoxes, setLoadingChatBoxes] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)

  // Pagination
  const [messagesPage, setMessagesPage] = useState(0)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)

  // Typing debounce ref
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)


  // ======================== API CALLS ========================

  const loadChatBoxes = async () => {
    try {
      setLoadingChatBoxes(true)
      const response = await chatService.getConversations(0, 50)
      setChatBoxes(response.content)
    } catch (error) {
      console.error('Failed to load chat boxes:', error)
      showToast('error', 'Không thể tải danh sách hội thoại')
    } finally {
      setLoadingChatBoxes(false)
    }
  }

  const loadMessages = async (chatBoxId: string, page: number, reset = false) => {
    try {
      setLoadingMessages(true)
      const response = await chatService.getMessages(chatBoxId, page, 50)

      // Map isMe based on senderType for Clinic staff
      // CLINIC messages are "mine", PET_OWNER messages are "theirs"
      // Note: API returns newest first (DESC), ChatBox component will reverse for display
      const mappedMessages = response.content.map((msg: ChatMessage) => ({
        ...msg,
        isMe: msg.senderType === 'CLINIC'
      }))

      if (reset) {
        setMessages(mappedMessages)
      } else {
        // Prepend older messages when loading more
        setMessages((prev) => [...mappedMessages, ...prev])
      }

      setMessagesPage(page)
      setHasMoreMessages(!response.last)
    } catch (error) {
      console.error('Failed to load messages:', error)
      showToast('error', 'Không thể tải tin nhắn')
    } finally {
      setLoadingMessages(false)
    }
  }

  const loadMoreMessages = () => {
    if (selectedChatBox && hasMoreMessages && !loadingMessages) {
      loadMessages(selectedChatBox.id, messagesPage + 1, false)
    }
  }

  // ======================== WEBSOCKET ========================

  const connectWebSocket = async () => {
    try {
      await chatWebSocket.connect()
      setWsConnected(true)
      console.log('WebSocket connected')
    } catch (error) {
      console.error('WebSocket connection failed:', error)
      setWsConnected(false)
      showToast('error', 'Không thể kết nối real-time. Tin nhắn có thể bị trễ.')
    }
  }



  // Use a ref to always have access to the current selectedChatBox.id
  // This avoids stale closures in WebSocket handlers
  const selectedChatBoxIdRef = useRef<string | null>(null)
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId)

  useEffect(() => {
    const currentId = selectedChatBox?.id ?? null
    selectedChatBoxIdRef.current = currentId
    setActiveConversationId(currentId)
    return () => setActiveConversationId(null)
  }, [selectedChatBox?.id, setActiveConversationId])

  // Removed duplicate refresh call - already handled in mount effect below

  const updateChatBoxLastMessage = useCallback((chatBoxId: string, message: ChatMessage) => {
    // Use ref to get the current selected chat box ID (avoids stale closure)
    const currentSelectedId = selectedChatBoxIdRef.current
    console.log('[WS DEBUG] updateChatBoxLastMessage called - chatBoxId:', chatBoxId, 'currentSelectedId:', currentSelectedId, 'senderType:', message.senderType)

    setChatBoxes((prev) => {
      console.log('[WS DEBUG] setChatBoxes - prev length:', prev.length)
      // Track decrement needed
      let decrementAmount = 0

      const updated = prev.map((cb) => {
        if (cb.id !== chatBoxId) return cb

        const isReadNow = currentSelectedId === chatBoxId || message.senderType === 'CLINIC'

        // Handle potentially undefined unreadCount to avoid NaN
        const currentCount = cb.unreadCount || 0
        const newUnreadCount = isReadNow ? 0 : currentCount + 1

        if (isReadNow && currentCount > 0) {
          decrementAmount = currentCount
        }

        return {
          ...cb,
          lastMessage: message.messageType === 'IMAGE' ? '[Hình ảnh]' : (message.content || ''),
          lastMessageSender: message.senderType,
          lastMessageAt: message.createdAt,
          unreadCount: newUnreadCount,
        }
      })

      if (decrementAmount > 0) {
        setTimeout(() => decrementChatUnreadCount(decrementAmount), 0)
      }

      // Re-sort: newest message first
      const sorted = [...updated].sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return timeB - timeA
      })
      console.log('[WS DEBUG] setChatBoxes - sorted[0]:', sorted[0]?.lastMessage, sorted[0]?.lastMessageSender)
      return sorted
    })

    // Update global chat unread count for navigation badge
    // HANDLED BY LAYOUT SUBSCRIPTION NOW
    /*
    if (message.senderType === 'PET_OWNER' && currentSelectedId !== chatBoxId) {
      incrementChatUnreadCount()
    }
    */

    // Also update selectedChatBox if it's the one receiving the message
    if (currentSelectedId === chatBoxId) {
      console.log('[WS DEBUG] Also updating selectedChatBox')

      // FORCE MARK READ ON SERVER if message is from PET_OWNER
      if (message.senderType === 'PET_OWNER') {
        chatService.markAsRead(chatBoxId).catch(err => console.error('Auto mark read failed', err))
      }

      setSelectedChatBox(prev => prev ? {
        ...prev,
        lastMessage: message.content,
        lastMessageSender: message.senderType,
        lastMessageAt: message.createdAt,
        unreadCount: 0,
        partnerOnline: prev.partnerOnline // Preserve online status
      } : null)
    }
  }, []) // No dependency needed since we use ref

  const handleWebSocketMessage = useCallback((wsMessage: ChatWebSocketMessage) => {
    console.log('[WS DEBUG] Received message:', wsMessage.type, wsMessage)
    switch (wsMessage.type) {
      case 'MESSAGE':
        if (wsMessage.message) {
          console.log('[WS DEBUG] Processing MESSAGE:', wsMessage.message.content)
          // Check if message already exists to avoid duplicate
          // This happens when we send a message and receive it back via WebSocket broadcast
          setMessages((prev) => {
            const messageExists = prev.some((m) => m.id === wsMessage.message!.id)
            if (messageExists) {
              console.log('[WS DEBUG] Message already exists, skipping')
              return prev
            }

            // Map isMe based on senderType for Clinic staff
            const mappedMessage = {
              ...wsMessage.message!,
              isMe: wsMessage.message!.senderType === 'CLINIC'
            }
            console.log('[WS DEBUG] Adding new message to chat')
            // Add to beginning of array because state stores DESC order (newest first)
            // ChatBox.tsx reverses for display (oldest first, newest at bottom)
            return [mappedMessage, ...prev]
          })
          // Update chat box list
          console.log('[WS DEBUG] Calling updateChatBoxLastMessage for:', wsMessage.conversationId)
          updateChatBoxLastMessage(wsMessage.conversationId, wsMessage.message)
        }
        break

      case 'TYPING':
        if (wsMessage.senderType === 'PET_OWNER') {
          setIsPartnerTyping(true)
        }
        break

      case 'STOP_TYPING':
        if (wsMessage.senderType === 'PET_OWNER') {
          setIsPartnerTyping(false)
        }
        break

      case 'READ':
        // Update message status to SEEN
        setMessages((prev) =>
          prev.map((msg) =>
            msg.isMe && msg.status !== 'SEEN' ? { ...msg, status: 'SEEN' as const, isRead: true } : msg
          )
        )
        break

      case 'ONLINE':
        if (wsMessage.senderType === 'PET_OWNER') {
          setSelectedChatBox((prev) =>
            prev ? { ...prev, partnerOnline: true } : prev
          )
        }
        break

      case 'OFFLINE':
        if (wsMessage.senderType === 'PET_OWNER') {
          setSelectedChatBox((prev) =>
            prev ? { ...prev, partnerOnline: false } : prev
          )
        }
        break
    }
  }, [updateChatBoxLastMessage])

  // ======================== EFFECTS ========================

  // Load chat boxes on mount
  useEffect(() => {
    loadChatBoxes()
    refreshChatUnreadCount()
    connectWebSocket()

    return () => {
      // Cleanup typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      // Don't disconnect WebSocket as layout needs it for global updates
      // chatWebSocket.disconnect()
    }
  }, [])

  // Subscribe to ALL chat boxes for realtime updates in the list
  useEffect(() => {
    console.log('[WS DEBUG] Subscription effect - wsConnected:', wsConnected, 'chatBoxes.length:', chatBoxes.length)
    if (!wsConnected || chatBoxes.length === 0) {
      console.log('[WS DEBUG] Skipping subscription - conditions not met')
      return
    }

    console.log('[WS DEBUG] Subscribing to', chatBoxes.length, 'chat boxes')
    // Create a stable handle to the message handler to avoid unnecessary re-subscriptions
    const unsubscribes = chatBoxes.map(cb => {
      console.log('[WS DEBUG] Subscribing to chat box:', cb.id)
      return chatWebSocket.subscribeToChatBox(cb.id, handleWebSocketMessage)
    })

    // Keep subscriptions active for global updates even when navigating away
    // ACTUALLY: We MUST unsubscribe to prevent duplicate handlers (multiplier bug)
    return () => {
      console.log('[WS DEBUG] Unsubscribing from all chat boxes, count:', unsubscribes.length)
      unsubscribes.forEach(unsub => unsub())
    }
  }, [wsConnected, chatBoxes.length, handleWebSocketMessage])

  // Load messages and send online status for the selected chat box
  useEffect(() => {
    if (selectedChatBox) {
      loadMessages(selectedChatBox.id, 0, true)

      // Mark as read (handleSelectChatBox already updates UI immediately via decrementChatUnreadCount)
      chatService.markAsRead(selectedChatBox.id).catch(console.error)

      // Send online status
      chatWebSocket.sendOnlineStatus(selectedChatBox.id, true)
    }

    // Cleanup: send offline status when leaving chat box
    return () => {
      if (selectedChatBox && wsConnected) {
        chatWebSocket.sendOnlineStatus(selectedChatBox.id, false)
      }
    }
  }, [selectedChatBox?.id, wsConnected])

  // ======================== HANDLERS ========================

  const handleSelectChatBox = async (chatBox: ChatBoxType) => {
    // If clicking same chat, do nothing
    if (selectedChatBox?.id === chatBox.id) return

    // Get the current unread count before setting to 0, ensuring number type
    const count = Number(chatBox.unreadCount || 0)

    // 1. GLOBAL BADGE: Decrement immediately if needed
    if (count > 0) {
      decrementChatUnreadCount(count)
    }

    // 2. LOCAL BADGE: Optimistically clear unread count in the list
    setChatBoxes((prev) =>
      prev.map((cb) =>
        cb.id === chatBox.id ? { ...cb, unreadCount: 0 } : cb
      )
    )

    // 3. SET SELECTED CHAT (with 0 unread)
    setSelectedChatBox({ ...chatBox, unreadCount: 0 })
    setMessages([])
    setMessagesPage(0)
    setHasMoreMessages(false)
    setIsPartnerTyping(false)

    // 4. BACKEND SYNC: Mark as read
    chatService.markAsRead(chatBox.id)
      .then(() => console.log('Marked as read:', chatBox.id))
      .catch((err) => console.error('Failed to mark as read', err))

    // 5. LOAD MESSAGES
    await loadMessages(chatBox.id, 0, true)
  }

  const handleSendMessage = async (content: string) => {
    if (!selectedChatBox) return

    try {
      // Send via REST API - message will be added via WebSocket broadcast
      // DO NOT add message to state here to avoid duplicate
      // WebSocket will broadcast the message back to us
      await chatService.sendMessage(selectedChatBox.id, { content })
    } catch (error) {
      console.error('Failed to send message:', error)
      showToast('error', 'Không thể gửi tin nhắn. Vui lòng thử lại.')
    }
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

  const handleImageUpload = async (file: File) => {
    if (!selectedChatBox) return

    // Check file size limit (10MB)
    if (file.size > MAX_FILE_SIZE) {
      showToast('error', 'Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.')
      return
    }

    // Create optimistic message with local blob URL for immediate display
    const localImageUrl = URL.createObjectURL(file)
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId: selectedChatBox.id,
      senderId: '', // Will be filled by server
      senderType: 'CLINIC',
      senderName: 'Clinic Manager User',
      senderAvatar: null,
      content: '',
      messageType: 'IMAGE',
      imageUrl: localImageUrl,
      status: 'SENT',
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString(),
      isMe: true
    }

    // Add optimistic message immediately (at beginning since we store DESC order)
    setMessages(prev => [optimisticMessage, ...prev])

    try {
      // Upload image - this already creates and broadcasts the message via WebSocket
      await chatService.uploadImage(selectedChatBox.id, file)

      // Remove optimistic message when real message arrives via WebSocket
      // WebSocket handler will add the real message
      setMessages(prev => prev.filter(m => m.id !== tempId))

      // Cleanup blob URL
      URL.revokeObjectURL(localImageUrl)
    } catch (error) {
      console.error('Failed to upload image:', error)
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId))
      URL.revokeObjectURL(localImageUrl)
      showToast('error', 'Không thể tải lên hình ảnh. Vui lòng thử lại.')
      throw error
    }
  }

  const handleCombinedMessage = async (content: string, imageFile: File) => {
    if (!selectedChatBox) return

    // Check file size limit (10MB)
    if (imageFile.size > MAX_FILE_SIZE) {
      showToast('error', 'Ảnh vượt quá 10MB. Vui lòng chọn ảnh nhỏ hơn.')
      return
    }

    console.log('ChatPage.handleCombinedMessage called', { content, imageFile: imageFile.name })

    try {
      // Upload image first
      const uploadResponse = await chatService.uploadImage(selectedChatBox.id, imageFile)
      const imageUrl = uploadResponse.imageUrl

      console.log('ChatPage.handleCombinedMessage: Image uploaded', { imageUrl })

      // Send message with both text and image URL
      await chatService.sendMessage(selectedChatBox.id, {
        content,
        imageUrl
      })

      console.log('ChatPage.handleCombinedMessage: Combined message sent')
    } catch (error) {
      console.error('Failed to send combined message:', error)
      showToast('error', 'Không thể gửi tin nhắn. Vui lòng thử lại.')
      throw error
    }
  }

  const handleTyping = (typing: boolean) => {
    if (!selectedChatBox) return

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    if (typing) {
      // Send typing indicator
      chatWebSocket.sendTyping(selectedChatBox.id, true)

      // Auto stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        chatWebSocket.sendTyping(selectedChatBox.id, false)
      }, 3000)
    } else {
      // User stopped typing (e.g., sent message or cleared input)
      chatWebSocket.sendTyping(selectedChatBox.id, false)
    }
  }

  // Filter chat boxes by search
  const filteredChatBoxes = chatBoxes.filter((cb) =>
    cb.petOwnerName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex h-full bg-white overflow-hidden">
      {/* Chat Box Sidebar */}
      <div className="w-80 bg-stone-50 border-r-2 border-stone-900 flex flex-col">
        {/* Header */}
        <div className="p-5 border-b-2 border-stone-900 bg-white">
          <h1 className="text-2xl font-black uppercase mb-4 tracking-tight text-stone-900">
            CHAT TƯ VẤN
          </h1>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-stone-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 font-medium transition-all"
            />
          </div>
        </div>

        {/* Chat Box List */}
        <ChatBoxList
          chatBoxes={filteredChatBoxes}
          selectedId={selectedChatBox?.id ?? null}
          onSelect={handleSelectChatBox}
          loading={loadingChatBoxes}
        />
      </div>

      {/* Chat Area */}
      {selectedChatBox ? (
        <ChatBox
          chatBox={selectedChatBox}
          messages={messages}
          onSendMessage={handleSendMessage}
          onImageUpload={handleImageUpload}
          onCombinedMessage={handleCombinedMessage}
          onTyping={handleTyping}
          onLoadMore={loadMoreMessages}
          loading={loadingMessages}
          hasMore={hasMoreMessages}
          isPartnerTyping={isPartnerTyping}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-stone-50">
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-6 border-4 border-stone-900 border-dashed">
            <ChatBubbleLeftRightIcon className="w-12 h-12 text-stone-400" />
          </div>
          <h2 className="text-2xl font-black text-stone-900 mb-2">
            CHỌN MỘT CUỘC HỘI THOẠI
          </h2>
          <p className="text-stone-500 max-w-md font-medium">
            Chọn một cuộc trò chuyện từ danh sách bên trái để bắt đầu nhắn tin với khách hàng.
          </p>
        </div>
      )}
    </div>
  )
}

export default ChatPage
