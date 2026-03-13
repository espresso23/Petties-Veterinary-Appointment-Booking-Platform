import { useState, useEffect, useCallback, useRef } from 'react'
import { 
    SparklesIcon, 
    ChevronRightIcon,
    PlusIcon,
    TrashIcon,
    FolderIcon,
    UserGroupIcon,
    CalendarIcon,
    DocumentTextIcon,
    PencilIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline'
import { ChatbotUI, type ChatMessage } from './ChatbotUI'
import { useChatSidebar } from '../../hooks/useChatSidebar'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../hooks/useToast'
import { useAIChatStore, type AISessionMessage } from '../../store/aiChatStore'

interface ChatSession {
    session_id: string
    title?: string
    created_at: string
    updated_at?: string
    messages: ChatSessionMessage[]
}

interface ChatSessionMessage {
    message_id?: string
    role: 'user' | 'assistant'
    content: string
    timestamp?: string
}

interface ChatSidebarProps {
    title?: string
    placeholder?: string
}

const QUICK_ACTIONS = [
    { label: 'Tạo EMR mới', icon: DocumentTextIcon, prompt: 'Tạo EMR cho bệnh nhân' },
    { label: 'Xem bệnh nhân', icon: UserGroupIcon, prompt: 'Liệt kê bệnh nhân của phòng khám' },
    { label: 'Xem lịch hẹn', icon: CalendarIcon, prompt: 'Hiển thị lịch hẹn hôm nay' },
    { label: 'Chẩn đoán bệnh', icon: PencilIcon, prompt: 'Hỗ trợ chẩn đoán bệnh' },
]

const SUGGESTED_PROMPTS = [
    'Bệnh nhân nào đến khám hôm nay?',
    'Tạo EMR cho bé chó mèo',
    'Lịch hẹn trong tuần này',
    'Hướng dẫn chăm sóc thú cưng sau tiêm',
]

export const ChatSidebar = ({
    title = 'Trợ lý AI',
    placeholder = 'Nhập tin nhắn...'
}: ChatSidebarProps) => {
    const { isOpen, toggle, close } = useChatSidebar()
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [showSessionList, setShowSessionList] = useState(false)
    const [isLoadingSessions, setIsLoadingSessions] = useState(false)
    const [isCreatingSession, setIsCreatingSession] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const { showToast } = useToast()
    
    const accessToken = useAuthStore((state) => state.accessToken)
    
    // Use shared store
    const { 
        sessionId, 
        messages: storeMessages,
        connectionStatus,
        setSessionId,
        setMessages,
        addMessage,
        updateLastMessage,
        setConnectionStatus
    } = useAIChatStore()

    // Convert store messages to ChatMessage format for UI
    const messages: ChatMessage[] = storeMessages.map((msg: AISessionMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        isLoading: false
    }))

    // Load sessions list
    const loadSessions = useCallback(async () => {
        if (!accessToken) return
        
        setIsLoadingSessions(true)
        try {
            const response = await fetch(
                `${import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'}/api/v1/chat/sessions?limit=20`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            )
            
            if (response.ok) {
                const data = await response.json()
                setSessions(data.sessions || [])
            }
        } catch (error) {
            console.error('Failed to load sessions:', error)
        } finally {
            setIsLoadingSessions(false)
        }
    }, [accessToken])

    // Create new session
    const createNewSession = useCallback(async () => {
        if (!accessToken || isCreatingSession) return
        
        setIsCreatingSession(true)
        try {
            // Close existing WebSocket
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
            
            const response = await fetch(
                `${import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'}/api/v1/chat/sessions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        context_type: 'BUSINESS_CHAT'
                    })
                }
            )
            
            if (response.ok) {
                const data = await response.json()
                setSessionId(data.session_id)
                setMessages([])  // Clear store messages
                setShowSessionList(false)
                await loadSessions()
            }
        } catch (error) {
            console.error('Failed to create session:', error)
            showToast('error', 'Không thể tạo cuộc chat mới')
        } finally {
            setIsCreatingSession(false)
        }
    }, [accessToken, isCreatingSession, loadSessions, showToast, setSessionId, setMessages])

    // Delete session
    const deleteSession = useCallback(async (sessionIdToDelete: string) => {
        if (!accessToken) return
        
        try {
            const response = await fetch(
                `${import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'}/api/v1/chat/sessions/${sessionIdToDelete}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            )
            
            if (response.ok) {
                showToast('success', 'Đã xóa cuộc chat')
                
                // If deleting current session, create new one
                if (sessionId === sessionIdToDelete) {
                    await createNewSession()
                } else {
                    await loadSessions()
                }
            }
        } catch (error) {
            console.error('Failed to delete session:', error)
            showToast('error', 'Không thể xóa cuộc chat')
        }
    }, [accessToken, sessionId, createNewSession, loadSessions, showToast])

    // Select existing session
    const selectSession = useCallback(async (selectedSessionId: string) => {
        if (!accessToken) return
        
        // Close existing WebSocket
        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }
        
        try {
            const response = await fetch(
                `${import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'}/api/v1/chat/sessions/${selectedSessionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            )
            
            if (response.ok) {
                const data = await response.json()
                setSessionId(data.session_id)
                
                // Convert messages to ChatMessage format
                const convertedMessages: ChatMessage[] = (data.messages || []).map((msg: ChatSessionMessage) => ({
                    id: msg.message_id || Date.now().toString(),
                    role: msg.role,
                    content: msg.content,
                    timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
                }))
                
                setMessages(convertedMessages)
                setShowSessionList(false)
            }
        } catch (error) {
            console.error('Failed to load session:', error)
            showToast('error', 'Không thể tải cuộc chat')
        }
    }, [accessToken, showToast, setSessionId, setMessages])

    // Initial session creation and session list loading
    useEffect(() => {
        if (accessToken && isOpen) {
            loadSessions()
            
            // Create initial session if none exists
            if (!sessionId) {
                createNewSession()
            }
        }
    }, [accessToken, isOpen, loadSessions, createNewSession, sessionId])

    // Connect to WebSocket when session is created - use shared store
    useEffect(() => {
        if (!sessionId || !accessToken) return

        const AGENT_WS_BASE_URL = import.meta.env.VITE_AGENT_WS_BASE_URL || 'ws://localhost:8000'
        
        // Close existing WebSocket
        if (wsRef.current) {
            wsRef.current.close()
        }

        const wsUrl = `${AGENT_WS_BASE_URL}/ws/chat/${sessionId}?token=${accessToken}`
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            console.log('[ChatSidebar] WebSocket connected')
            setConnectionStatus('connected')
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('[ChatSidebar] WebSocket message:', data)

                if (data.type === 'session_established' || data.type === 'ack' || data.type === 'agent_info') {
                    return
                }

                if (data.type === 'react_step') {
                    const step = data.step || {}
                    const thought = step.thought || step.action || step.observation || ''
                    if (thought) {
                        addMessage({
                            id: `step-${Date.now()}`,
                            role: 'assistant',
                            content: thought,
                            timestamp: new Date()
                        })
                    }
                    return
                }

                if (data.type === 'stream' || data.type === 'final' || data.type === 'complete') {
                    // Handle different response formats
                    const content = data.content || data.full_response || ''
                    if (content) {
                        updateLastMessage(content, false)
                    }
                    
                    // Also handle thinking/reasoning content
                    if (data.thinking || data.reasoning) {
                        const thoughtContent = data.thinking || data.reasoning
                        addMessage({
                            id: `thinking-${Date.now()}`,
                            role: 'assistant',
                            content: thoughtContent,
                            timestamp: new Date()
                        })
                    }
                    return
                }

                // Handle thinking type (for reasoning display)
                if (data.type === 'thinking') {
                    const step = data.step || {}
                    const content = data.content || step.thought || step.content || ''
                    
                    // Update existing loading message instead of adding new one
                    if (content) {
                        updateLastMessage(content, true) // true = still loading/thinking
                    }
                    return
                }

                // Handle complete/final response
                if (data.type === 'complete') {
                    const content = data.full_response || data.content || ''
                    if (content) {
                        updateLastMessage(content, false) // false = done loading
                    }
                    return
                }

                if (data.type === 'error') {
                    addMessage({
                        id: `error-${Date.now()}`,
                        role: 'assistant',
                        content: `Lỗi: ${data.error}`,
                        timestamp: new Date()
                    })
                }
            } catch (err) {
                console.error('[ChatSidebar] Failed to parse WS message:', err)
            }
        }

        ws.onerror = (error) => {
            console.error('[ChatSidebar] WebSocket error:', error)
            setConnectionStatus('disconnected')
        }

        ws.onclose = () => {
            console.log('[ChatSidebar] WebSocket closed')
            setConnectionStatus('disconnected')
        }

        wsRef.current = ws

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [sessionId, accessToken, addMessage, updateLastMessage, setConnectionStatus])

    const handleSendMessage = useCallback(async (message: string, images?: string[]): Promise<{ processingStatus?: string }> => {
        if (!message.trim() && (!images || images.length === 0)) {
            return {}
        }

        const hasImages = images && images.length > 0
        
        // Check WebSocket connection
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            // Fallback to REST API if WebSocket is not available
            if (sessionId && accessToken) {
                try {
                    const response = await fetch(
                        `${import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'}/api/v1/chat/sessions/${sessionId}/messages`, 
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${accessToken}`
                            },
                            body: JSON.stringify({ message, images })
                        }
                    )
                    
                    if (response.ok) {
                        // Add user message to store
                        addMessage({
                            id: Date.now().toString(),
                            role: 'user',
                            content: message,
                            timestamp: new Date()
                        })
                        
                        // Add assistant message
                        addMessage({
                            id: (Date.now() + 1).toString(),
                            role: 'assistant',
                            content: 'Đang xử lý...',
                            timestamp: new Date()
                        })
                        
                        return {}
                    } else {
                        showToast('error', 'Không thể gửi tin nhắn')
                        return {}
                    }
                } catch {
                    showToast('error', 'Đã xảy ra lỗi khi gửi tin nhắn')
                    return {}
                }
            }
            return {}
        }

        // Show processing status if has images
        if (hasImages) {
            return { processingStatus: 'Đang phân tích ảnh...' }
        }

        // Add user message to store (will show in both Spotlight and Sidebar)
        addMessage({
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: new Date()
        })

        // Add loading message to store
        addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '',
            timestamp: new Date()
        })

        // Send via WebSocket
        wsRef.current.send(JSON.stringify({
            message,
            images
        }))

        return {}
    }, [sessionId, accessToken, showToast, addMessage])

    const handleQuickAction = (prompt: string) => {
        handleSendMessage(prompt)
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Vừa xong'
        if (diffMins < 60) return `${diffMins} phút trước`
        if (diffHours < 24) return `${diffHours} giờ trước`
        if (diffDays < 7) return `${diffDays} ngày trước`
        return date.toLocaleDateString('vi-VN')
    }

    return (
        <>
            {/* Toggle Button - Fixed on right edge */}
            <button
                onClick={toggle}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-10 h-16 bg-amber-500 border-y-2 border-l-2 border-stone-900 shadow-[-3px_3px_0_#1c1917] hover:bg-amber-600 transition-all duration-300 rounded-l-lg"
            >
                {isOpen ? (
                    <ChevronRightIcon className="w-5 h-5 text-white" />
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <SparklesIcon className="w-5 h-5 text-white" />
                    </div>
                )}
            </button>

            {/* Sidebar Container - slides from right */}
            <div 
                className={`fixed right-0 top-0 h-full w-[400px] z-30 transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Sidebar Content */}
                <div className="h-full border-l-2 border-stone-900 shadow-[-4px_4px_0_#1c1917] bg-white flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b-2 border-stone-900 bg-amber-500">
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="w-5 h-5 text-white" />
                            <h2 className="text-lg font-black text-white uppercase tracking-wide">
                                {title}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSessionList(!showSessionList)}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                title="Danh sách chat"
                            >
                                <FolderIcon className="w-5 h-5 text-white" />
                            </button>
                            <button 
                                onClick={close}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <ChevronRightIcon className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Session List Panel */}
                    {showSessionList && (
                        <div className="border-b-2 border-stone-900 bg-stone-50">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-stone-200">
                                <span className="text-sm font-bold text-stone-700">Danh sách cuộc chat</span>
                                <button
                                    onClick={createNewSession}
                                    disabled={isCreatingSession}
                                    className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded border border-stone-900 shadow-[1px_1px_0_#1c1917] hover:bg-amber-600 disabled:opacity-50"
                                >
                                    {isCreatingSession ? (
                                        <ArrowPathIcon className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <PlusIcon className="w-3 h-3" />
                                    )}
                                    Chat mới
                                </button>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto">
                                {isLoadingSessions ? (
                                    <div className="p-4 text-center text-stone-500 text-sm">
                                        Đang tải...
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <div className="p-4 text-center text-stone-500 text-sm">
                                        Chưa có cuộc chat nào
                                    </div>
                                ) : (
                                    sessions.map((session) => (
                                        <div 
                                            key={session.session_id}
                                            className={`flex items-center justify-between px-4 py-2 border-b border-stone-100 hover:bg-stone-100 cursor-pointer ${
                                                session.session_id === sessionId ? 'bg-amber-50' : ''
                                            }`}
                                            onClick={() => selectSession(session.session_id)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-stone-800 truncate">
                                                    {session.title || 'Cuộc chat mới'}
                                                </p>
                                                <p className="text-xs text-stone-500">
                                                    {formatDate(session.created_at)}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    deleteSession(session.session_id)
                                                }}
                                                className="p-1 hover:bg-red-100 rounded"
                                                title="Xóa"
                                            >
                                                <TrashIcon className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Main Content - Chat or Welcome */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        <ChatbotUI 
                            title={title}
                            placeholder={placeholder}
                            onSendMessage={handleSendMessage}
                            initialMessages={messages}
                            onClose={close}
                            quickActions={QUICK_ACTIONS}
                            suggestedPrompts={SUGGESTED_PROMPTS}
                            onQuickAction={handleQuickAction}
                            showHeader={false}
                        />
                    </div>
                </div>
            </div>

            {/* Backdrop when sidebar is open */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 z-20"
                    onClick={close}
                />
            )}
        </>
    )
}

export default ChatSidebar
