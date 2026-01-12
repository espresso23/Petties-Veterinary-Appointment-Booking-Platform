import { useState, useEffect, useCallback, useRef } from 'react'
import { MagnifyingGlassIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'
import { ChatBoxList, ChatBox } from '../../components/chat'
import { chatService } from '../../services/api/chatService'
import { chatWebSocket } from '../../services/websocket/chatWebSocket'
import { useToast } from '../../hooks/useToast'
import type { ChatBox as ChatBoxType, ChatMessage, ChatWebSocketMessage } from '../../types/chat'

/**
 * Chat Page for Clinic Manager
 * Displays chat boxes with Pet Owners and allows messaging
 */
export function ChatPage() {
  const { showToast } = useToast()

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
  useEffect(() => {
    selectedChatBoxIdRef.current = selectedChatBox?.id ?? null
  }, [selectedChatBox?.id])

  const updateChatBoxLastMessage = useCallback((chatBoxId: string, message: ChatMessage) => {
    // Use ref to get the current selected chat box ID (avoids stale closure)
    const currentSelectedId = selectedChatBoxIdRef.current
    console.log('[WS DEBUG] updateChatBoxLastMessage called - chatBoxId:', chatBoxId, 'currentSelectedId:', currentSelectedId, 'senderType:', message.senderType)

    setChatBoxes((prev) => {
      console.log('[WS DEBUG] setChatBoxes - prev length:', prev.length)
      const updated = prev.map((cb) =>
        cb.id === chatBoxId
          ? {
            ...cb,
            lastMessage: message.content,
            lastMessageSender: message.senderType,
            lastMessageAt: message.createdAt,
            // Unread count logic:
            // - If viewing this chat: 0
            // - If CLINIC sent (own message): 0 (implicitly read by sending)
            // - If PET_OWNER sent: increment
            unreadCount:
              currentSelectedId === chatBoxId || message.senderType === 'CLINIC'
                ? 0
                : cb.unreadCount + 1,
          }
          : cb
      )

      // Re-sort: newest message first
      const sorted = [...updated].sort((a, b) => {
        const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
        const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
        return timeB - timeA
      })
      console.log('[WS DEBUG] setChatBoxes - sorted[0]:', sorted[0]?.lastMessage, sorted[0]?.lastMessageSender)
      return sorted
    })

    // Also update selectedChatBox if it's the one receiving the message
    if (currentSelectedId === chatBoxId) {
      console.log('[WS DEBUG] Also updating selectedChatBox')
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
    connectWebSocket()

    return () => {
      // Cleanup typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      chatWebSocket.disconnect()
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

    return () => {
      console.log('[WS DEBUG] Unsubscribing from all chat boxes')
      unsubscribes.forEach(unsub => unsub())
    }
  }, [wsConnected, chatBoxes.length, handleWebSocketMessage])

  // Load messages and send online status for the selected chat box
  useEffect(() => {
    if (selectedChatBox) {
      loadMessages(selectedChatBox.id, 0, true)

      // Mark as read
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

  const handleSelectChatBox = (chatBox: ChatBoxType) => {
    // Always update unread count in list
    setChatBoxes((prev) =>
      prev.map((cb) =>
        cb.id === chatBox.id ? { ...cb, unreadCount: 0 } : cb
      )
    )

    // If clicking the same conversation, just mark as read, don't reset state
    if (selectedChatBox?.id === chatBox.id) {
      chatService.markAsRead(chatBox.id).catch(console.error)
      return
    }

    setSelectedChatBox(chatBox)
    setMessages([])
    setMessagesPage(0)
    setHasMoreMessages(false)
    setIsPartnerTyping(false)
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
