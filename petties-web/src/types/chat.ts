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

// ======================== AI CHAT SCHEMA ========================

export type ChatStage = 'IDLE' | 'COLLECTING' | 'PRESENTING' | 'CONFIRMING' | 'BOOKED'

export type UIActionType =
  | 'select_item'
  | 'select_services'
  | 'confirm_booking'
  | 'open_native_confirm'
  | 'cancel_flow'
  | 'load_more'
  | 'open_detail'
  | 'retry_with_change'
  | 'dismiss'

export type UIComponentType =
  | 'pet_card'
  | 'clinic_card'
  | 'service_chip'
  | 'slot_button'
  | 'booking_summary'
  | 'emr_summary'
  | 'vaccination_card'
  | 'text'
  | 'badge'
  | 'button'
  | 'empty_state'
  | 'error_card'

export interface UIAction {
  type: UIActionType
  label: string
  payload?: Record<string, unknown>
}

export interface UIComponent {
  type: UIComponentType
  id: string
  data: Record<string, unknown>
  actions?: UIAction[]
}

export interface UISchemaV1 {
  version: '1.0'
  layout: 'list' | 'grid' | 'card' | 'slot_grid'
  components: UIComponent[]
  metadata?: {
    title?: string
    description?: string
    empty_state?: string
    pagination?: {
      total: number
      shown: number
      has_more: boolean
      next_cursor?: string
    }
  }
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderType: 'PET_OWNER' | 'CLINIC'
  senderName: string
  senderAvatar: string | null
  content: string
  messageType: 'TEXT' | 'IMAGE' | 'IMAGE_TEXT' | 'AI_RESPONSE'
  imageUrl: string | null
  status: 'SENT' | 'DELIVERED' | 'SEEN'
  isRead: boolean
  readAt: string | null
  createdAt: string
  isMe: boolean
  isUploading?: boolean // Used for optimistic UI during upload
  
  // AI Specific fields
  stage?: ChatStage
  ui_schema?: UISchemaV1
  
  actionButtons?: {
    id: string
    label: string
    type: 'MENU' | 'OFFER' | 'BOOKING' | 'CUSTOM'
  }[]
}

export interface SendMessageRequest {
  content: string
  imageUrl?: string
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

// ======================== AUTO REPLY SETTINGS ========================

export type AutoReplyCondition = 'OFF_HOURS' | 'ALWAYS'

export interface ChatAutoReplySettings {
  clinicId: string
  quickReplyEnabled: boolean
  quickReplyMessage: string
  awayMessageEnabled: boolean
  awayCondition: AutoReplyCondition
  awayMessage: string
  actionButtons?: {
    id: string
    label: string
    type: 'MENU' | 'OFFER' | 'BOOKING' | 'CUSTOM'
  }[]
}

export interface UpdateChatAutoReplySettingsRequest {
  quickReplyEnabled: boolean
  quickReplyMessage: string
  awayMessageEnabled: boolean
  awayCondition: AutoReplyCondition
  awayMessage: string
  actionButtons?: {
    id: string
    label: string
    type: 'MENU' | 'OFFER' | 'BOOKING' | 'CUSTOM'
  }[]
}
