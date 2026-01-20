import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock dependencies before importing the hook
const mockShowToast = vi.fn();
const mockIncrementUnreadCount = vi.fn();
const mockRefreshUnreadCount = vi.fn();
const mockSetPendingCount = vi.fn();

vi.mock('../../store/authStore', () => ({
    useAuthStore: vi.fn(() => ({
        accessToken: null,
        isAuthenticated: false,
    })),
}));

vi.mock('../../store/notificationStore', () => ({
    useNotificationStore: vi.fn(() => ({
        unreadCount: 0,
        incrementUnreadCount: mockIncrementUnreadCount,
        refreshUnreadCount: mockRefreshUnreadCount,
    })),
}));

vi.mock('../../store/clinicStore', () => ({
    useClinicStore: vi.fn(() => ({
        setPendingCount: mockSetPendingCount,
    })),
}));

vi.mock('../../components/Toast', () => ({
    useToast: vi.fn(() => ({
        showToast: mockShowToast,
    })),
}));

vi.mock('../../config/env', () => ({
    env: {
        API_BASE_URL: 'http://localhost:8080/api',
    },
}));

// Mock EventSource
class MockEventSource {
    url: string;
    withCredentials: boolean;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    readyState: number = 0;
    private listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

    static instances: MockEventSource[] = [];

    constructor(url: string, options?: { withCredentials?: boolean }) {
        this.url = url;
        this.withCredentials = options?.withCredentials ?? false;
        MockEventSource.instances.push(this);
    }

    addEventListener(type: string, listener: (event: MessageEvent) => void) {
        if (!this.listeners.has(type)) {
            this.listeners.set(type, []);
        }
        this.listeners.get(type)!.push(listener);
    }

    removeEventListener(type: string, listener: (event: MessageEvent) => void) {
        const listeners = this.listeners.get(type);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    dispatchEvent(type: string, data: unknown) {
        const event = new MessageEvent(type, { data: JSON.stringify(data) });
        const listeners = this.listeners.get(type) || [];
        listeners.forEach(listener => listener(event));
        if (this.onmessage && type === 'message') {
            this.onmessage(event);
        }
    }

    close() {
        this.readyState = 2;
    }

    // Helper to simulate connection open
    simulateOpen() {
        this.readyState = 1;
        if (this.onopen) {
            this.onopen(new Event('open'));
        }
    }

    // Helper to simulate connection error
    simulateError() {
        if (this.onerror) {
            this.onerror(new Event('error'));
        }
    }
}

// Replace global EventSource
vi.stubGlobal('EventSource', MockEventSource);

import { useSseNotification } from '../useSseNotification';
import { useAuthStore } from '../../store/authStore';

describe('useSseNotification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        MockEventSource.instances = [];
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Connection Management', () => {
        it('should not connect when not authenticated', () => {
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
                accessToken: null,
                isAuthenticated: false,
            });

            renderHook(() => useSseNotification());

            expect(MockEventSource.instances.length).toBe(0);
        });

        it('should auto-connect when authenticated', async () => {
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
                accessToken: 'test-token-123',
                isAuthenticated: true,
            });

            renderHook(() => useSseNotification());

            expect(MockEventSource.instances.length).toBe(1);
            expect(MockEventSource.instances[0].url).toContain('token=test-token-123');
        });

        it('should auto-disconnect when logout (isAuthenticated becomes false)', () => {
            const mockAuth = {
                accessToken: 'test-token-123',
                isAuthenticated: true,
            };

            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockAuth);

            const { rerender } = renderHook(() => useSseNotification());

            expect(MockEventSource.instances.length).toBe(1);
            const eventSource = MockEventSource.instances[0];

            // Simulate logout
            mockAuth.accessToken = '';
            mockAuth.isAuthenticated = false;
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockAuth);

            rerender();

            expect(eventSource.readyState).toBe(2); // CLOSED
        });

        it('should set isConnected to true after successful connection', async () => {
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
                accessToken: 'test-token-123',
                isAuthenticated: true,
            });

            const { result } = renderHook(() => useSseNotification());

            expect(result.current.isConnected).toBe(false);

            // Simulate connection open
            act(() => {
                MockEventSource.instances[0].simulateOpen();
            });

            expect(result.current.isConnected).toBe(true);
        });

        it('should attempt reconnect after connection loss', async () => {
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
                accessToken: 'test-token-123',
                isAuthenticated: true,
            });

            renderHook(() => useSseNotification({ reconnectDelay: 1000 }));

            expect(MockEventSource.instances.length).toBe(1);

            // Simulate connection open then error
            act(() => {
                MockEventSource.instances[0].simulateOpen();
            });

            act(() => {
                MockEventSource.instances[0].simulateError();
            });

            // Wait for reconnect delay
            act(() => {
                vi.advanceTimersByTime(1000);
            });

            // Should have created a new EventSource instance
            expect(MockEventSource.instances.length).toBe(2);
        });

        it('should stop reconnecting after max attempts reached', () => {
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
                accessToken: 'test-token-123',
                isAuthenticated: true,
            });

            renderHook(() => useSseNotification({
                reconnectDelay: 100,
                maxReconnectAttempts: 3,
            }));

            // Initial connection
            expect(MockEventSource.instances.length).toBe(1);

            // Simulate 3 failures (max attempts)
            for (let i = 0; i < 3; i++) {
                act(() => {
                    MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();
                });
                act(() => {
                    vi.advanceTimersByTime(100);
                });
            }

            const instancesBeforeWait = MockEventSource.instances.length;

            // One more error - should NOT reconnect
            act(() => {
                MockEventSource.instances[MockEventSource.instances.length - 1].simulateError();
            });
            act(() => {
                vi.advanceTimersByTime(100);
            });

            // Should not have created another instance
            expect(MockEventSource.instances.length).toBe(instancesBeforeWait);
        });
    });

    describe('Notification Handling', () => {
        beforeEach(() => {
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
                accessToken: 'test-token-123',
                isAuthenticated: true,
            });
        });

        it('should show toast when receiving NOTIFICATION event', () => {
            const onNotification = vi.fn();

            renderHook(() => useSseNotification({ onNotification }));

            // Simulate connection open
            act(() => {
                MockEventSource.instances[0].simulateOpen();
            });

            // Dispatch notification event
            act(() => {
                MockEventSource.instances[0].dispatchEvent('NOTIFICATION', {
                    type: 'NOTIFICATION',
                    data: {
                        notificationId: '123',
                        type: 'APPROVED',
                        message: 'Phòng khám đã được duyệt',
                        clinicName: 'Phòng Khám ABC',
                        read: false,
                        createdAt: new Date().toISOString(),
                    },
                    timestamp: new Date().toISOString(),
                });
            });

            expect(mockShowToast).toHaveBeenCalledWith('success', expect.any(String));
            expect(mockIncrementUnreadCount).toHaveBeenCalled();
            expect(onNotification).toHaveBeenCalled();
        });

        it('should increment unread count when receiving notification', () => {
            renderHook(() => useSseNotification());

            act(() => {
                MockEventSource.instances[0].simulateOpen();
            });

            act(() => {
                MockEventSource.instances[0].dispatchEvent('NOTIFICATION', {
                    type: 'NOTIFICATION',
                    data: {
                        notificationId: '123',
                        type: 'VET_SHIFT_ASSIGNED',
                        message: 'Bạn được gán ca làm việc mới',
                        read: false,
                        createdAt: new Date().toISOString(),
                    },
                    timestamp: new Date().toISOString(),
                });
            });

            expect(mockIncrementUnreadCount).toHaveBeenCalled();
        });
    });

    describe('Manual Controls', () => {
        it('should allow manual disconnect', () => {
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
                accessToken: 'test-token-123',
                isAuthenticated: true,
            });

            const { result } = renderHook(() => useSseNotification());

            act(() => {
                MockEventSource.instances[0].simulateOpen();
            });

            expect(result.current.isConnected).toBe(true);

            act(() => {
                result.current.disconnect();
            });

            expect(result.current.isConnected).toBe(false);
            expect(MockEventSource.instances[0].readyState).toBe(2);
        });

        it('should allow manual reconnect', () => {
            (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
                accessToken: 'test-token-123',
                isAuthenticated: true,
            });

            const { result } = renderHook(() => useSseNotification());

            expect(MockEventSource.instances.length).toBe(1);

            act(() => {
                result.current.reconnect();
            });

            expect(MockEventSource.instances.length).toBe(2);
        });
    });
});
