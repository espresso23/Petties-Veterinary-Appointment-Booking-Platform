import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import type { IMessage } from '@stomp/stompjs'
import { env } from '../../config/env'
import { useAuthStore } from '../../store/authStore'
import type { ChatWebSocketMessage } from '../../types/chat'

/**
 * WebSocket Service for real-time chat
 * Uses STOMP protocol over SockJS
 */

type MessageHandler = (message: ChatWebSocketMessage) => void

class ChatWebSocketService {
  private client: Client | null = null
  private subscriptions: Map<string, () => void> = new Map()
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private isConnecting = false

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    if (this.client?.connected || this.isConnecting) {
      return Promise.resolve()
    }

    this.isConnecting = true

    return new Promise((resolve, reject) => {
      // WebSocket endpoint is at /api/ws due to backend context path
      const wsUrl = `${env.API_BASE_URL.replace('/api', '')}/api/ws`
      const accessToken = useAuthStore.getState().accessToken

      // Only log connection success, not every attempt

      if (!accessToken) {
        console.error('[WS] No access token available')
        this.isConnecting = false
        reject(new Error('No access token'))
        return
      }

      this.client = new Client({
        webSocketFactory: () => new SockJS(wsUrl),
        connectHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
        // Disable verbose STOMP debug logs
        debug: () => { },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
        onConnect: () => {
          console.log('[WS] Connected successfully')
          this.isConnecting = false
          this.reconnectAttempts = 0
          resolve()
        },
        onStompError: (frame) => {
          console.error('[WS] STOMP Error:', frame.headers['message'])
          this.isConnecting = false
          reject(new Error(frame.headers['message']))
        },
        onDisconnect: () => {
          this.isConnecting = false
        },
        onWebSocketClose: () => {
          this.isConnecting = false
          this.handleReconnect()
        },
        onWebSocketError: (event) => {
          console.error('[WS] WebSocket Error:', event)
          this.isConnecting = false
          reject(new Error('WebSocket connection error'))
        },
      })

      this.client.activate()
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    // Reset connection flags FIRST to allow reconnection
    this.isConnecting = false
    this.reconnectAttempts = 0

    if (this.client) {
      // Unsubscribe all
      this.subscriptions.forEach((unsubscribe) => unsubscribe())
      this.subscriptions.clear()
      this.messageHandlers.clear()

      this.client.deactivate()
      this.client = null
    }
  }

  /**
   * Subscribe to a chat box's messages
   */
  subscribeToChatBox(chatBoxId: string, handler: MessageHandler): () => void {
    if (!this.client?.connected) {
      // Silently fail if not connected
      return () => { }
    }

    const destination = `/topic/chat/${chatBoxId}`
    // Subscribe to chat topic

    // Store handler
    if (!this.messageHandlers.has(chatBoxId)) {
      this.messageHandlers.set(chatBoxId, new Set())
    }
    this.messageHandlers.get(chatBoxId)!.add(handler)

    // Subscribe if not already
    if (!this.subscriptions.has(chatBoxId)) {
      const subscription = this.client.subscribe(destination, (message: IMessage) => {
        try {
          const wsMessage: ChatWebSocketMessage = JSON.parse(message.body)
          const handlers = this.messageHandlers.get(chatBoxId)
          // Dispatch to handlers
          handlers?.forEach((h) => h(wsMessage))
        } catch (e) {
          console.error('[WS] Failed to parse message:', e)
        }
      })

      this.subscriptions.set(chatBoxId, () => subscription.unsubscribe())
    }

    // Return unsubscribe function for this handler
    return () => {
      const handlers = this.messageHandlers.get(chatBoxId)
      if (handlers) {
        handlers.delete(handler)
        // If no more handlers, unsubscribe from topic
        if (handlers.size === 0) {
          const unsubscribe = this.subscriptions.get(chatBoxId)
          if (unsubscribe) {
            unsubscribe()
            this.subscriptions.delete(chatBoxId)
          }
          this.messageHandlers.delete(chatBoxId)
        }
      }
    }
  }

  /**
   * Send a message via WebSocket
   */
  sendMessage(chatBoxId: string, content: string): void {
    if (!this.client?.connected) {
      console.warn('[WS] Not connected, cannot send')
      return
    }

    this.client.publish({
      destination: `/app/chat/${chatBoxId}/send`,
      body: JSON.stringify({ content }),
    })
  }

  /**
   * Send typing indicator
   */
  sendTyping(chatBoxId: string, typing: boolean): void {
    if (!this.client?.connected) return

    this.client.publish({
      destination: `/app/chat/${chatBoxId}/typing`,
      body: JSON.stringify({ typing }),
    })
  }

  /**
   * Send read receipt
   */
  sendRead(chatBoxId: string): void {
    if (!this.client?.connected) return

    this.client.publish({
      destination: `/app/chat/${chatBoxId}/read`,
      body: '{}',
    })
  }

  /**
   * Send online status
   */
  sendOnlineStatus(chatBoxId: string, online: boolean): void {
    if (!this.client?.connected) return

    this.client.publish({
      destination: `/app/chat/${chatBoxId}/online`,
      body: JSON.stringify({ online }),
    })
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.connected ?? false
  }

  /**
   * Handle reconnection
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      // Silent reconnection
      setTimeout(() => {
        this.connect().catch(console.error)
      }, 5000 * this.reconnectAttempts)
    }
  }
}

// Singleton instance
export const chatWebSocket = new ChatWebSocketService()
export default chatWebSocket
