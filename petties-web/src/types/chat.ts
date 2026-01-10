/**
 * Chat Types for Petties Web
 */

// ======================== CONVERSATION ========================

export interface Conversation {
  id: string
  petOwnerId: string
  petOwnerName: string
  petOwnerAvatar: string | null
  clinicId: string
  clinicName: string
  clinicLogo: string | null
  lastMessage: string | null
  lastMessageSender: 'PET_OWNER' | 'CLINIC' | null
  lastMessageAt: string | null
  unreadCount: number
  partnerOnline: boolean
  createdAt: string
}

export interface CreateConversationRequest {
  clinicId: string
  initialMessage?: string
}

// ======================== MESSAGE ========================

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderType: 'PET_OWNER' | 'CLINIC'
  senderName: string
  senderAvatar: string | null
  content: string
  status: 'SENT' | 'DELIVERED' | 'SEEN'
  isRead: boolean
  readAt: string | null
  createdAt: string
  isMe: boolean
}

export interface SendMessageRequest {
  content: string
}

// ======================== WEBSOCKET ========================

export type WebSocketMessageType =
  | 'MESSAGE'
  | 'TYPING'
  | 'STOP_TYPING'
  | 'READ'
  | 'ONLINE'
  | 'OFFLINE'

export interface ChatWebSocketMessage {
  type: WebSocketMessageType
  conversationId: string
  chatBoxId?: string // Backend may use this field name instead of conversationId
  message?: ChatMessage
  senderId?: string
  senderType?: 'PET_OWNER' | 'CLINIC'
  timestamp: string
}

// ======================== RESPONSE ========================

export interface UnreadCountResponse {
  totalUnreadConversations: number
  totalUnreadMessages: number
}

export interface PageResponse<T> {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  first: boolean
  last: boolean
  empty: boolean
}

// ======================== BACKWARD COMPATIBILITY ========================
// Deprecated: Use Conversation instead
export type ChatBox = Conversation
export type CreateChatBoxRequest = CreateConversationRequest
