import { useCallback, useEffect, useRef, useState } from 'react'
import { useGlobalHotkey } from '../../hooks/useGlobalHotkey'
import { useMascotPanel } from '../../hooks/useMascotPanel'
import { useAuthStore } from '../../store/authStore'
import { useAIChatStore } from '../../store/aiChatStore'
import { useLocation, useNavigate } from 'react-router-dom'
import type { UIAction, UISchemaV1 } from '../../types/chat-copilot'
import { useToast } from '../Toast'
import { MascotLauncher } from './MascotLauncher'
import { MascotDockPanel } from './MascotDockPanel'

interface MascotProviderProps {
    children?: React.ReactNode
}

const looksLikeJsonPayload = (value: unknown): boolean => {
    if (typeof value !== 'string') return false
    let text = value.trim()
    if (!text) return false

    // Remove markdown code blocks if present
    if (text.startsWith('```json')) {
        text = text.substring(7).trim()
    } else if (text.startsWith('```')) {
        text = text.substring(3).trim()
    }
    if (text.endsWith('```')) {
        text = text.substring(0, text.length - 3).trim()
    }

    if (!(text.startsWith('{') || text.startsWith('['))) return false

    try {
        JSON.parse(text)
        return true
    } catch {
        // If it can't be parsed, fallback to heuristic
        return (
            text.includes('"success"') ||
            text.includes('"data"') ||
            text.includes('"suggestion') ||
            text.includes('"error_code"') ||
            text.includes('"ui_card"') ||
            text.includes('"type"')
        )
    }
}

export const MascotProvider = ({ children }: MascotProviderProps) => {
    const navigate = useNavigate()
    const location = useLocation()
    const { isOpen, context, open, close } = useMascotPanel()
    const accessToken = useAuthStore((state) => state.accessToken)
    const user = useAuthStore((state) => state.user)
    const { showToast } = useToast()

    const {
        sessionId,
        messages,
        connectionStatus,
        setSessionId,
        deleteSession,
        setMessages,
        addMessage,
        updateLastMessage,
        appendThinkingToLastMessage,
        appendToolCallToLastMessage,
        attachToolResultToLastMessage,
        setConnectionStatus,
        setIsOpen: setStoreIsOpen
    } = useAIChatStore()

    const wsRef = useRef<WebSocket | null>(null)
    const streamBufferRef = useRef('')
    const [bookingAlert, setBookingAlert] = useState<{ bookingId: string; bookingCode?: string } | null>(null)
    const AGENT_WS_BASE_URL = import.meta.env.VITE_AGENT_WS_BASE_URL || 'ws://localhost:8000'
    const canUseMascot = Boolean(
        accessToken &&
        user &&
        ['STAFF', 'CLINIC_MANAGER', 'CLINIC_OWNER'].includes(user.role),
    )

    const buildBaseContext = useCallback((): Record<string, unknown> => {
        const selectedClinic = useAIChatStore.getState().selectedClinic
        return {
            source: 'global_mascot_panel',
            role: user?.role,
            route: location.pathname,
            clinic_id: selectedClinic?.clinicId ?? user?.workingClinicId ?? null,
            clinic_name: selectedClinic?.clinicName ?? null,
            user_id: user?.userId,
        }
    }, [location.pathname, user?.role, user?.workingClinicId, user?.userId])

    const openMascot = useCallback((extraContext?: Record<string, unknown>) => {
        if (!canUseMascot) {
            showToast('error', 'Bạn không có quyền sử dụng trợ lý Petties ở khu vực này.')
            return
        }

        const mergedContext = {
            ...buildBaseContext(),
            ...(extraContext || {}),
        }

        open(mergedContext)
    }, [buildBaseContext, canUseMascot, open, showToast])

    const toggleMascot = useCallback(() => {
        if (isOpen) {
            close()
            return
        }

        openMascot()
    }, [close, isOpen, openMascot])

    // Connect to WebSocket
    const connectWebSocket = (sid: string) => {
        if (!accessToken) return

        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
            return
        }

        setConnectionStatus('connecting')
        const wsUrl = `${AGENT_WS_BASE_URL}/ws/chat/${sid}?token=${accessToken}`
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            console.log('[Mascot] WebSocket connected')
            setConnectionStatus('connected')
            streamBufferRef.current = ''
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('[Mascot] WebSocket message:', data)

                if (data.type === 'connected' || data.type === 'history' || data.type === 'agent_info') {
                    return
                }

                if (data.type === 'ack') {
                    streamBufferRef.current = ''
                    return
                }

                if (data.type === 'thinking' || data.type === 'thinking_stream') {
                    const content = (data.content || '').toString().trim()
                    if (content) {
                        appendThinkingToLastMessage(content)
                    }
                    return
                }

                if (data.type === 'tool_call') {
                    appendToolCallToLastMessage(
                        (data.tool_name || 'unknown').toString(),
                        data.tool_params || {}
                    )
                    return
                }

                if (data.type === 'tool_result') {
                    attachToolResultToLastMessage(data.tool_name, data.result)
                    return
                }

                if (data.type === 'stream') {
                    const chunk = (data.content || '').toString()
                    if (!chunk) {
                        return
                    }
                    streamBufferRef.current += chunk
                    updateLastMessage(streamBufferRef.current, true)
                    return
                }

                if (data.type === 'ui_schema') {
                    addMessage({
                        id: `ui-${Date.now()}`,
                        role: 'assistant',
                        content: '',
                        timestamp: new Date(),
                        uiSchema: data.ui_schema as UISchemaV1,
                        stage: data.stage,
                        isLoading: false,
                    })
                    return
                }

                if (data.type === 'booking_state_update') {
                    return
                }

                if (data.type === 'complete') {
                    const content = (data.full_response || streamBufferRef.current || '').toString()
                    setMessages((prev) => {
                        const messagesSnapshot = [...prev]
                        
                        // Clear isLoading for ALL assistant messages to avoid "hanging" states
                        const updated = messagesSnapshot.map((msg, idx) => {
                            if (msg.role === 'assistant' && msg.isLoading) {
                                // If it's the last message and we have content, update it
                                if (idx === messagesSnapshot.length - 1) {
                                    return {
                                        ...msg,
                                        content: msg.content || (looksLikeJsonPayload(content) ? '' : content),
                                        isLoading: false
                                    }
                                }
                                return { ...msg, isLoading: false }
                            }
                            return msg
                        })

                        // If last message was user (though unlikely here), or no assistant message was found to update
                        const last = updated[updated.length - 1]
                        if (content && (!last || last.role !== 'assistant' || last.content !== content)) {
                             if (!looksLikeJsonPayload(content)) {
                                 updated.push({
                                     id: `ai-${Date.now()}`,
                                     role: 'assistant',
                                     content,
                                     timestamp: new Date(),
                                     isLoading: false,
                                 })
                             }
                        }

                        return updated
                    })
                    streamBufferRef.current = ''
                    return
                }

                if (data.type === 'error') {
                    const reason = (data.error || 'Lỗi không xác định').toString()
                    const code = data.error_code ? ` (${data.error_code})` : ''
                    const suggestion = data.suggestion ? ` ${data.suggestion}` : ''
                    addMessage({
                        id: `error-${Date.now()}`,
                        role: 'assistant',
                        content: `Lỗi${code}: ${reason}${suggestion}`,
                        timestamp: new Date()
                    })
                }
            } catch (err) {
                console.error('[Mascot] Failed to parse WS message:', err)
            }
        }

        ws.onerror = (error) => {
            console.error('[Mascot] WebSocket error:', error)
            setConnectionStatus('disconnected')
        }

        ws.onclose = () => {
            console.log('[Mascot] WebSocket closed')
            setConnectionStatus('disconnected')
            streamBufferRef.current = ''
        }

        wsRef.current = ws
    }

    // Create session when mascot panel opens
    useEffect(() => {
        const initMascotSession = async () => {
            if (!accessToken || !isOpen || sessionId) return

            try {
                const baseUrl = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'
                const response = await fetch(`${baseUrl}/api/v1/chat/sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        context_type: 'BUSINESS_CHAT',
                        context_data: buildBaseContext(),
                    })
                })

                if (response.ok) {
                    const data = await response.json()
                    const newSessionId = data.session_id
                    setSessionId(newSessionId)
                    connectWebSocket(newSessionId)
                }
            } catch (error) {
                console.error('[Mascot] Failed to create session:', error)
            }
        }

        if (isOpen && !sessionId) {
            initMascotSession()
        }
    }, [isOpen, accessToken, sessionId, buildBaseContext])

    // Reconnect WebSocket when session becomes available
    useEffect(() => {
        if (sessionId && isOpen && connectionStatus === 'disconnected') {
            connectWebSocket(sessionId)
        }
    }, [sessionId, isOpen, connectionStatus])

    // Sync isOpen state with store
    useEffect(() => {
        setStoreIsOpen(isOpen)
    }, [isOpen, setStoreIsOpen])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [])

    // Clear messages and selected clinic when mascot panel closes
    useEffect(() => {
        if (!isOpen) {
            setMessages([])
            // Keep selectedClinic state persisted across opens for continuity
        }
    }, [isOpen, setMessages])

    // Handle global hotkey
    useGlobalHotkey({
        enabled: true,
        onTrigger: toggleMascot,
    })

    useEffect(() => {
        if (!canUseMascot && isOpen) {
            close()
        }
    }, [canUseMascot, close, isOpen])

    useEffect(() => {
        const handleExternalOpen = (event: Event) => {
            const customEvent = event as CustomEvent<Record<string, unknown> | undefined>
            const detail = customEvent.detail

            if (detail && typeof detail.booking_id === 'string' && detail.booking_id.trim()) {
                setBookingAlert({
                    bookingId: detail.booking_id,
                    bookingCode: typeof detail.booking_code === 'string' ? detail.booking_code : undefined,
                })
            }

            openMascot(detail)
        }

        window.addEventListener('petties-open-mascot', handleExternalOpen as EventListener)

        return () => {
            window.removeEventListener('petties-open-mascot', handleExternalOpen as EventListener)
        }
    }, [openMascot])

    const handleViewBookingDetail = useCallback(
        (bookingId: string) => {
            navigate('/staff/bookings', { state: { focusBookingId: bookingId } })
        },
        [navigate],
    )

    // Handle sending message to AI
    const handleSendMessage = async (
        message: string,
        additionalContext?: Record<string, unknown>
    ) => {
        if (!accessToken) {
            return {
                response: 'Vui lòng đăng nhập để sử dụng AI Assistant',
                actions: [],
                suggestions: []
            }
        }

        if (!sessionId) {
            return {
                response: 'Đang kết nối... Vui lòng chờ trong giây lát.',
                actions: [],
                suggestions: []
            }
        }

        // Add user message to store (will show in mascot panel and sidebar)
        addMessage({
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
            timestamp: new Date()
        })

        // Add loading message
        addMessage({
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true
        })

        // Send via WebSocket only to avoid duplicated persistence paths.
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                message,
                context_data: {
                    ...buildBaseContext(),
                    ...(context || {}),
                    ...(additionalContext || {}),
                },
            }))
            console.log('[Mascot] Sent via existing WebSocket')
        } else {
            updateLastMessage('Kết nối chưa sẵn sàng. Vui lòng thử lại sau vài giây.', false)
            showToast('error', 'Kết nối trợ lý AI chưa sẵn sàng. Vui lòng thử lại.')
        }

        return {
            response: '',
            actions: [],
            suggestions: []
        }
    }

    const handleSendUiAction = useCallback(
        async (action: UIAction, displayMessage?: string) => {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                showToast('error', 'Kết nối trợ lý AI chưa sẵn sàng. Vui lòng thử lại.')
                return
            }

            // if (displayMessage?.trim()) {
            //     addMessage({
            //         id: `user-${Date.now()}`,
            //         role: 'user',
            //         content: displayMessage.trim(),
            //         timestamp: new Date(),
            //     })
            // }

            addMessage({
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                isLoading: true,
            })

            wsRef.current.send(
                JSON.stringify({
                    message: '',
                    display_message: displayMessage,
                    ui_action: {
                        type: action.type,
                        ...(action.payload || {}),
                    },
                    context_data: {
                        ...buildBaseContext(),
                        ...(context || {}),
                    },
                }),
            )
        },
        [addMessage, buildBaseContext, context, showToast],
    )

    const handleDeleteConversation = useCallback(async () => {
        if (!sessionId || !accessToken) {
            showToast('error', 'Không có phiên chat để xóa.')
            return
        }

        try {
            const baseUrl = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'
            const response = await fetch(`${baseUrl}/api/v1/chat/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            if (response.ok) {
                // Close existing WebSocket
                if (wsRef.current) {
                    wsRef.current.close()
                    wsRef.current = null
                }

                // Clear local state
                deleteSession()
                showToast('success', 'Đã xóa lịch sử trò chuyện')

                // Create new session
                const newSessionResponse = await fetch(`${baseUrl}/api/v1/chat/sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({
                        context_type: 'BUSINESS_CHAT',
                        context_data: buildBaseContext(),
                    })
                })

                if (newSessionResponse.ok) {
                    const data = await newSessionResponse.json()
                    const newSessionId = data.session_id
                    setSessionId(newSessionId)
                    connectWebSocket(newSessionId)
                }
            } else {
                const errorData = await response.json().catch(() => ({}))
                showToast('error', errorData.detail || 'Không thể xóa lịch sử trò chuyện')
            }
        } catch (error) {
            console.error('[Mascot] Failed to delete conversation:', error)
            showToast('error', 'Không thể xóa lịch sử trò chuyện')
        }
    }, [sessionId, accessToken, buildBaseContext, deleteSession, setSessionId, showToast])

    const handleLoadSession = useCallback(async (targetSessionId: string) => {
        if (!accessToken) {
            showToast('error', 'Vui lòng đăng nhập để tải lịch sử.')
            return
        }

        try {
            // Close existing WebSocket
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }

            // Update session ID
            setSessionId(targetSessionId)
            setMessages([])
            setConnectionStatus('connecting')

            // Load session with messages
            const baseUrl = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'
            const response = await fetch(`${baseUrl}/api/v1/chat/sessions/${targetSessionId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            })

            if (response.ok) {
                const data = await response.json()

                // Map messages to store format
                const mappedMessages = (data.messages || []).map((msg: any) => ({
                    id: msg.message_id || `msg-${msg.id || Date.now()}`,
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content || '',
                    timestamp: new Date(msg.created_at || Date.now()),
                    uiSchema: typeof msg.ui_schema === 'string' ? JSON.parse(msg.ui_schema) : msg.ui_schema || undefined,
                    stage: msg.stage || undefined,
                    isLoading: false,
                }))

                setMessages(mappedMessages)
                setConnectionStatus('connected')

                // Connect WebSocket for the new session
                connectWebSocket(targetSessionId)
            } else {
                showToast('error', 'Không thể tải phiên trò chuyện')
            }
        } catch (error) {
            console.error('[Mascot] Failed to load session:', error)
            showToast('error', 'Không thể tải phiên trò chuyện')
        }
    }, [accessToken, setSessionId, setMessages, setConnectionStatus, showToast])

    const handleNewChat = useCallback(async () => {
        if (!accessToken) {
            showToast('error', 'Vui lòng đăng nhập để tạo cuộc trò chuyện mới.')
            return
        }

        try {
            // Close existing WebSocket
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }

            // Clear current state
            deleteSession()

            // Create new session
            const baseUrl = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'
            const response = await fetch(`${baseUrl}/api/v1/chat/sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    context_type: 'BUSINESS_CHAT',
                    context_data: buildBaseContext(),
                })
            })

            if (response.ok) {
                const data = await response.json()
                const newSessionId = data.session_id
                setSessionId(newSessionId)
                connectWebSocket(newSessionId)
                showToast('success', 'Đã tạo cuộc trò chuyện mới')
            } else {
                showToast('error', 'Không thể tạo cuộc trò chuyện mới')
            }
        } catch (error) {
            console.error('[Mascot] Failed to create new chat:', error)
            showToast('error', 'Không thể tạo cuộc trò chuyện mới')
        }
    }, [accessToken, buildBaseContext, deleteSession, setSessionId, showToast])

    return (
        <>
            {children}

            {canUseMascot && (
                <MascotLauncher isOpen={isOpen} onToggle={toggleMascot} />
            )}

            <MascotDockPanel
                isOpen={isOpen}
                onClose={close}
                onSendMessage={handleSendMessage}
                onSendUiAction={handleSendUiAction}
                onDeleteConversation={handleDeleteConversation}
                onLoadSession={handleLoadSession}
                onNewChat={handleNewChat}
                messages={messages}
                connectionStatus={connectionStatus}
                routePath={location.pathname}
                bookingAlert={bookingAlert}
                onViewBookingDetail={handleViewBookingDetail}
            />
        </>
    )
}

export default MascotProvider
