import apiClient from './client'
import type {
  Conversation,
  CreateConversationRequest,
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
  // ======================== CONVERSATIONS ========================

  /**
   * Create or get existing conversation with a clinic
   * Only Pet Owner can create conversations
   */
  createOrGetConversation: async (request: CreateConversationRequest): Promise<Conversation> => {
    const response = await apiClient.post<Conversation>('/chat/conversations', request)
    return response.data
  },

  /**
   * Get all conversations for the current user
   */
  getConversations: async (page = 0, size = 20): Promise<PageResponse<Conversation>> => {
    const response = await apiClient.get<PageResponse<Conversation>>('/chat/conversations', {
      params: { page, size },
    })
    return response.data
  },

  /**
   * Get a specific conversation by ID
   */
  getConversation: async (conversationId: string): Promise<Conversation> => {
    const response = await apiClient.get<Conversation>(`/chat/conversations/${conversationId}`)
    return response.data
  },

  // ======================== MESSAGES ========================

  /**
   * Get messages in a conversation with pagination
   */
  getMessages: async (
    conversationId: string,
    page = 0,
    size = 50
  ): Promise<PageResponse<ChatMessage>> => {
    const response = await apiClient.get<PageResponse<ChatMessage>>(
      `/chat/conversations/${conversationId}/messages`,
      { params: { page, size } }
    )
    return response.data
  },

  /**
   * Send a message in a conversation
   */
  sendMessage: async (
    conversationId: string,
    request: SendMessageRequest
  ): Promise<ChatMessage> => {
    const response = await apiClient.post<ChatMessage>(
      `/chat/conversations/${conversationId}/messages`,
      request
    )
    return response.data
  },

  /**
   * Upload an image for a conversation
   */
  uploadImage: async (
    conversationId: string,
    file: File
  ): Promise<{ imageUrl: string }> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiClient.post<{ imageUrl: string }>(
      `/chat/conversations/${conversationId}/images`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    )
    return response.data
  },

  /**
   * Mark all messages in a conversation as read
   */
  markAsRead: async (conversationId: string): Promise<void> => {
    await apiClient.put(`/chat/conversations/${conversationId}/read`)
  },

  // ======================== UNREAD COUNT ========================

  /**
   * Get total unread conversation count
   */
  getUnreadCount: async (): Promise<UnreadCountResponse> => {
    const response = await apiClient.get<UnreadCountResponse>('/chat/unread-count')
    return response.data
  },
}

export default chatService
