import SockJS from 'sockjs-client'
import { Client } from '@stomp/stompjs'
import type { IMessage } from '@stomp/stompjs'
import { env } from '../../config/env'
import { useAuthStore } from '../../store/authStore'

/**
 * SOS Alert message received from server
 */
export interface SosAlertMessage {
    bookingId: string
    // Backend sends 'event' field for matching status
    event?: 'SEARCHING' | 'CLINIC_NOTIFIED' | 'WAITING_NEXT' | 'CONFIRMED' | 'DECLINED' | 'NO_CLINIC' | 'CANCELLED' | 'STAFF_ASSIGNED'
    // Legacy status field for compatibility
    status?: 'SEARCHING' | 'PENDING_CLINIC_CONFIRM' | 'CONFIRMED' | 'CANCELLED' | 'NO_CLINIC'
    petId?: string
    petName?: string
    petOwnerName?: string
    petOwnerPhone?: string
    symptoms?: string
    latitude?: number
    longitude?: number
    distance?: number
    distanceKm?: number
    message?: string
    timestamp?: string
    // Clinic info
    clinicId?: string
    clinicName?: string
    clinicPhone?: string
    remainingSeconds?: number
}

type SosAlertHandler = (message: SosAlertMessage) => void

/**
 * WebSocket Service for SOS Alert notifications to Clinic Managers
 * Uses STOMP protocol over SockJS
 */
class SosWebSocketService {
    private client: Client | null = null
    private subscriptions: Map<string, () => void> = new Map()
    private alertHandlers: Set<SosAlertHandler> = new Set()
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private isConnecting = false
    private clinicId: string | null = null

    /**
     * Connect to WebSocket server
     */
    connect(clinicId: string): Promise<void> {
        if (this.client?.connected || this.isConnecting) {
            return Promise.resolve()
        }

        this.clinicId = clinicId
        this.isConnecting = true

        return new Promise((resolve, reject) => {
            const wsUrl = `${env.API_BASE_URL.replace('/api', '')}/api/ws`
            const accessToken = useAuthStore.getState().accessToken

            if (!accessToken) {
                console.error('[SOS WS] No access token available')
                this.isConnecting = false
                reject(new Error('No access token'))
                return
            }

            this.client = new Client({
                webSocketFactory: () => new SockJS(wsUrl),
                connectHeaders: {
                    Authorization: `Bearer ${accessToken}`,
                },
                debug: () => { },
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                onConnect: () => {
                    console.log('[SOS WS] Connected successfully')
                    this.isConnecting = false
                    this.reconnectAttempts = 0
                    // Auto-subscribe to SOS alerts for this clinic
                    if (this.clinicId) {
                        this.subscribeToClinicAlerts(this.clinicId)
                    }
                    resolve()
                },
                onStompError: (frame) => {
                    console.error('[SOS WS] STOMP Error:', frame.headers['message'])
                    this.isConnecting = false
                    reject(new Error(frame.headers['message']))
                },
                onDisconnect: () => {
                    console.log('[SOS WS] Disconnected')
                    this.isConnecting = false
                },
                onWebSocketClose: () => {
                    this.isConnecting = false
                    this.handleReconnect()
                },
                onWebSocketError: (event) => {
                    console.error('[SOS WS] WebSocket Error:', event)
                    this.isConnecting = false
                    reject(new Error('WebSocket connection error'))
                },
            })

            this.client.activate()
        })
    }

    /**
     * Subscribe to SOS alerts for a clinic
     */
    private subscribeToClinicAlerts(clinicId: string): void {
        if (!this.client?.connected) return

        const destination = `/topic/clinic/${clinicId}/sos-alert`
        console.log('[SOS WS] Subscribing to:', destination)

        const subscription = this.client.subscribe(destination, (message: IMessage) => {
            try {
                const alertMessage: SosAlertMessage = JSON.parse(message.body)
                console.log('[SOS WS] Received SOS Alert:', alertMessage)
                this.alertHandlers.forEach((handler) => handler(alertMessage))
            } catch (e) {
                console.error('[SOS WS] Failed to parse SOS alert:', e)
            }
        })

        this.subscriptions.set(`sos-${clinicId}`, () => subscription.unsubscribe())
    }

    /**
     * Add alert handler
     */
    addAlertHandler(handler: SosAlertHandler): () => void {
        this.alertHandlers.add(handler)
        return () => {
            this.alertHandlers.delete(handler)
        }
    }

    /**
     * Remove alert handler
     */
    removeAlertHandler(handler: SosAlertHandler): void {
        this.alertHandlers.delete(handler)
    }

    /**
     * Confirm SOS request
     */
    confirmSos(bookingId: string): void {
        if (!this.client?.connected) {
            console.warn('[SOS WS] Not connected, cannot send confirmation')
            return
        }

        this.client.publish({
            destination: `/app/sos/${bookingId}/confirm`,
            body: JSON.stringify({ confirmed: true }),
        })
        console.log('[SOS WS] Sent SOS confirmation for:', bookingId)
    }

    /**
     * Decline SOS request
     */
    declineSos(bookingId: string, reason?: string): void {
        if (!this.client?.connected) {
            console.warn('[SOS WS] Not connected, cannot send decline')
            return
        }

        this.client.publish({
            destination: `/app/sos/${bookingId}/decline`,
            body: JSON.stringify({ accepted: false, reason }),
        })
        console.log('[SOS WS] Sent SOS decline for:', bookingId)
    }

    /**
     * Disconnect from WebSocket server
     */
    disconnect(): void {
        this.isConnecting = false
        this.reconnectAttempts = 0

        if (this.client) {
            this.subscriptions.forEach((unsubscribe) => unsubscribe())
            this.subscriptions.clear()
            this.alertHandlers.clear()
            this.client.deactivate()
            this.client = null
        }
        this.clinicId = null
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
        if (this.reconnectAttempts < this.maxReconnectAttempts && this.clinicId) {
            this.reconnectAttempts++
            setTimeout(() => {
                if (this.clinicId) {
                    this.connect(this.clinicId).catch(console.error)
                }
            }, 5000 * this.reconnectAttempts)
        }
    }
}

// Singleton instance
export const sosWebSocket = new SosWebSocketService()
export default sosWebSocket
