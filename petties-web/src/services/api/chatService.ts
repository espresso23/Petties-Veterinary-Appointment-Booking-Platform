import apiClient from './client'
import type {
  ChatBox,
  CreateChatBoxRequest,
  ChatMessage,
  SendMessageRequest,
  UnreadCountResponse,
  PageResponse,
} from '../../types/chat'

/**
 * Chat API Service
 * Base path: /api/chat
 */
export const chatService = {
  // ======================== CHAT BOXES ========================

  /**
   * Create or get existing chat box with a clinic
   * Only Pet Owner can create chat boxes
   */
  createOrGetChatBox: async (request: CreateChatBoxRequest): Promise<ChatBox> => {
    const response = await apiClient.post<ChatBox>('/chat/chat-boxes', request)
    return response.data
  },

  /**
   * Get all chat boxes for the current user
   */
  getChatBoxes: async (page = 0, size = 20): Promise<PageResponse<ChatBox>> => {
    const response = await apiClient.get<PageResponse<ChatBox>>('/chat/chat-boxes', {
      params: { page, size },
    })
    return response.data
  },

  /**
   * Get a specific chat box by ID
   */
  getChatBox: async (chatBoxId: string): Promise<ChatBox> => {
    const response = await apiClient.get<ChatBox>(`/chat/chat-boxes/${chatBoxId}`)
    return response.data
  },

  // ======================== MESSAGES ========================

  /**
   * Get messages in a chat box with pagination
   */
  getMessages: async (
    chatBoxId: string,
    page = 0,
    size = 50
  ): Promise<PageResponse<ChatMessage>> => {
    const response = await apiClient.get<PageResponse<ChatMessage>>(
      `/chat/chat-boxes/${chatBoxId}/messages`,
      { params: { page, size } }
    )
    return response.data
  },

  /**
   * Send a message in a chat box
   */
  sendMessage: async (
    chatBoxId: string,
    request: SendMessageRequest
  ): Promise<ChatMessage> => {
    const response = await apiClient.post<ChatMessage>(
      `/chat/chat-boxes/${chatBoxId}/messages`,
      request
    )
    return response.data
  },

  /**
   * Mark all messages in a chat box as read
   */
  markAsRead: async (chatBoxId: string): Promise<void> => {
    await apiClient.put(`/chat/chat-boxes/${chatBoxId}/read`)
  },

  // ======================== UNREAD COUNT ========================

  /**
   * Get total unread chat box count
   */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await apiClient.get<UnreadCountResponse>('/chat/unread-count')
    return response.data
  },
}

export default chatService
