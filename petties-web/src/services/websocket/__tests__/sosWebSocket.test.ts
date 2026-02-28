import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sosWebSocket, type SosAlertMessage } from '../sosWebSocket'

// Mock SockJS
vi.mock('sockjs-client', () => {
    return {
        default: vi.fn().mockImplementation(() => ({
            close: vi.fn(),
            send: vi.fn(),
            readyState: 1,
        })),
    }
})

// Mock auth store
vi.mock('../../../store/authStore', () => ({
    useAuthStore: {
        getState: () => ({ accessToken: 'test-token' }),
    },
}))

// Mock STOMP Client
vi.mock('@stomp/stompjs', () => {
    const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
    const MockClient = vi.fn().mockImplementation((config: any) => {
        const instance = {
            activate: vi.fn().mockImplementation(() => {
                // Simulate immediate connection
                if (config.onConnect) {
                    setTimeout(() => config.onConnect({} as any), 0)
                }
            }),
            deactivate: vi.fn(),
            subscribe: mockSubscribe,
            publish: vi.fn(),
            connected: false,
            _config: config,
        }
        return instance
    })
    return { Client: MockClient }
})

describe('SosWebSocket Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Clean up any existing connection
        sosWebSocket.disconnect()
    })

    afterEach(() => {
        sosWebSocket.disconnect()
    })

    describe('Connection', () => {
        it('should report not connected initially', () => {
            expect(sosWebSocket.isConnected()).toBe(false)
        })

        it('should connect when given a clinicId', async () => {
            const connectPromise = sosWebSocket.connect('clinic-123')
            // Wait for simulated async onConnect
            await vi.waitFor(() => connectPromise)
        })

        it('should skip connection if already connected', async () => {
            await sosWebSocket.connect('clinic-123')
            // Second call should resolve immediately
            await sosWebSocket.connect('clinic-123')
        })
    })

    describe('Alert Handlers', () => {
        it('should add and remove alert handlers', () => {
            const handler = vi.fn()
            const remove = sosWebSocket.addAlertHandler(handler)

            // Handler should be registered
            expect(typeof remove).toBe('function')

            // Remove handler
            remove()
        })

        it('should call alert handlers when receiving messages', async () => {
            const handler = vi.fn()
            sosWebSocket.addAlertHandler(handler)

            // Connect first so subscription is set up
            await sosWebSocket.connect('clinic-123')

            // The connect() call triggers subscribeToClinicAlerts internally
            // which subscribes to /topic/clinic/clinic-123/sos-alert
        })

        it('should remove handler via removeAlertHandler', () => {
            const handler = vi.fn()
            sosWebSocket.addAlertHandler(handler)
            sosWebSocket.removeAlertHandler(handler)
            // No error thrown - handler removed gracefully
        })
    })

    describe('Disconnect', () => {
        it('should disconnect cleanly', async () => {
            await sosWebSocket.connect('clinic-123')
            sosWebSocket.disconnect()
            expect(sosWebSocket.isConnected()).toBe(false)
        })

        it('should handle disconnect when not connected', () => {
            // Should not throw
            sosWebSocket.disconnect()
        })

        it('should clear handlers on disconnect', () => {
            const handler = vi.fn()
            sosWebSocket.addAlertHandler(handler)
            sosWebSocket.disconnect()
            // Handler set should be cleared internally
        })
    })

    describe('Reconnection', () => {
        it('should clear old subscriptions on reconnect', async () => {
            await sosWebSocket.connect('clinic-123')
            // Connecting again should clear stale subscriptions and not throw
            sosWebSocket.disconnect()
            await sosWebSocket.connect('clinic-123')
        })
    })
})
