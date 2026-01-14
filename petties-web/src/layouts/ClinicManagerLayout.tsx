import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { useChatStore } from '../store/chatStore'
import { Sidebar } from '../components/Sidebar/Sidebar'
import type { NavGroup } from '../components/Sidebar/Sidebar'
import { useSidebar } from '../hooks/useSidebar'
import { useSseNotification } from '../hooks/useSseNotification'
import { chatWebSocket } from '../services/websocket/chatWebSocket'
import { chatService } from '../services/api/chatService'
import type { ChatWebSocketMessage } from '../types/chat'
import {
    Squares2X2Icon,
    UserGroupIcon,
    CalendarIcon,
    ClipboardDocumentListIcon,
    ChatBubbleLeftRightIcon,
    CurrencyDollarIcon,
    BellIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline'
import '../styles/brutalist.css'

export const ClinicManagerLayout = () => {
    const navigate = useNavigate()
    const clearAuth = useAuthStore((state) => state.clearAuth)
    const user = useAuthStore((state) => state.user)
    const unreadCount = useNotificationStore((state) => state.unreadCount)
    const refreshUnreadCount = useNotificationStore((state) => state.refreshUnreadCount)
    const chatUnreadCount = useChatStore((state) => state.unreadCount)
    const refreshChatUnreadCount = useChatStore((state) => state.refreshUnreadCount)
    const incrementChatUnreadCount = useChatStore((state) => state.incrementUnreadCount)
    const { state, toggleSidebar, isMobile } = useSidebar()

    // Initialize SSE
    useSseNotification()

    // Connect to chat WebSocket for global unread count updates
    useEffect(() => {
        const connectChatWebSocket = async () => {
            try {
                await chatWebSocket.connect()
                console.log('Global chat WebSocket connected')
            } catch (error) {
                console.error('Global chat WebSocket connection failed:', error)
            }
        }

        connectChatWebSocket()

        // WebSocket is kept connected for ChatPage subscriptions to persist
        // ChatPage handlers will update unread count globally

        return () => {
            // Don't disconnect WebSocket as ChatPage subscriptions need it
        }
    }, [])

    useEffect(() => {
        refreshUnreadCount()
        refreshChatUnreadCount()

        // GLOBAL SUBSCRIPTION for Sidebar Badge
        let unsubscribes: (() => void)[] = []

        const setupGlobalSubscriptions = async () => {
            try {
                // Fetch recent conversations to listen for updates
                // We fetch top 50. If user receives msg from old chat (50+), it won't trigger badge instantly.
                // This is a trade-off for performance.
                const response = await chatService.getConversations(0, 50)
                const conversations = response.content

                console.log('[Layout] Setting up global subscriptions for', conversations.length, 'chats')

                // Subscribe to each to detect new messages
                unsubscribes = conversations.map(conv => {
                    return chatWebSocket.subscribeToChatBox(conv.id, (wsMessage: ChatWebSocketMessage) => {
                        if (wsMessage.type === 'MESSAGE' && wsMessage.message) {
                            const msg = wsMessage.message
                            if (msg.senderType === 'PET_OWNER') {
                                // Check if this chat is currently active in view
                                // Direct store access to get fresh state without re-running effect
                                const currentActiveId = useChatStore.getState().activeConversationId

                                if (currentActiveId !== conv.id) {
                                    console.log('[Layout] Incrementing global badge for chat', conv.id)
                                    incrementChatUnreadCount()
                                } else {
                                    console.log('[Layout] Skipping global increment - Chat active:', conv.id)
                                }
                            }
                        }
                    })
                })
            } catch (error) {
                console.error('[Layout] Failed to setup global subscriptions:', error)
            }
        }

        // Wait a bit for connection to be ready (it connects in parallel effect)
        const timer = setTimeout(() => {
            setupGlobalSubscriptions()
        }, 1000)

        return () => {
            clearTimeout(timer)
            unsubscribes.forEach(u => u())
        }
    }, [refreshUnreadCount, refreshChatUnreadCount, incrementChatUnreadCount])

    const navGroups: NavGroup[] = [
        {
            title: 'QUẢN LÝ',
            items: [
                { path: '/clinic-manager', label: 'DASHBOARD', icon: Squares2X2Icon, end: true },
                { path: '/clinic-manager/vets', label: 'BÁC SĨ', icon: UserGroupIcon },
                { path: '/clinic-manager/shifts', label: 'LỊCH LÀM VIỆC', icon: CalendarIcon },
                { path: '/clinic-manager/bookings', label: 'BOOKING', icon: ClipboardDocumentListIcon },
            ]
        },
        {
            title: 'HỆ THỐNG',
            items: [
                { path: '/clinic-manager/chat', label: 'CHAT TƯ VẤN', icon: ChatBubbleLeftRightIcon, unreadCount: chatUnreadCount },
                { path: '/clinic-manager/refunds', label: 'HOÀN TIỀN', icon: CurrencyDollarIcon },
                { path: '/clinic-manager/notifications', label: 'THÔNG BÁO', icon: BellIcon, unreadCount },
                { path: '/clinic-manager/profile', label: 'HỒ SƠ CÁ NHÂN', icon: UserCircleIcon },
            ]
        }
    ]

    const handleLogout = () => {
        clearAuth()
        navigate('/login', { replace: true })
    }

    return (
        <div className="h-screen bg-stone-50 flex overflow-hidden">
            <Sidebar
                groups={navGroups}
                user={user}
                roleName="CLINIC MANAGER"
                state={state}
                toggleSidebar={toggleSidebar}
                onLogout={handleLogout}
                isMobile={isMobile}
            />

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-stone-50 relative">
                <div className="p-0 h-full">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}

export default ClinicManagerLayout
