import { useEffect, useRef } from 'react'
import { useGlobalHotkey } from '../../hooks/useGlobalHotkey'
import { useSpotlight } from '../../hooks/useSpotlight'
import { SpotlightModal, type AIAction } from './SpotlightModal'
import { useAuthStore } from '../../store/authStore'
import { useAIChatStore } from '../../store/aiChatStore'
import { useNavigate } from 'react-router-dom'
import { useMembershipStore } from '../../store/membershipStore'
import { useToast } from '../Toast'

interface SpotlightProviderProps {
    children?: React.ReactNode
}

export const SpotlightProvider = ({ children }: SpotlightProviderProps) => {
    const navigate = useNavigate()
    const { isOpen, position, context, open, close } = useSpotlight()
    const accessToken = useAuthStore((state) => state.accessToken)
    const isVIP = useMembershipStore(state => state.isVIP())
    const loadingMembership = useMembershipStore(state => state.isLoading)
    const { showToast } = useToast()

    const {
        sessionId,
        messages,
        connectionStatus,
        setSessionId,
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
    const AGENT_WS_BASE_URL = import.meta.env.VITE_AGENT_WS_BASE_URL || 'ws://localhost:8000'

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
            console.log('[Spotlight] WebSocket connected')
            setConnectionStatus('connected')
            streamBufferRef.current = ''
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('[Spotlight] WebSocket message:', data)

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

                if (data.type === 'complete') {
                    const content = (data.full_response || streamBufferRef.current || '').toString()
                    if (content) {
                        updateLastMessage(content, false)
                    }
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
                console.error('[Spotlight] Failed to parse WS message:', err)
            }
        }

        ws.onerror = (error) => {
            console.error('[Spotlight] WebSocket error:', error)
            setConnectionStatus('disconnected')
        }

        ws.onclose = () => {
            console.log('[Spotlight] WebSocket closed')
            setConnectionStatus('disconnected')
            streamBufferRef.current = ''
        }

        wsRef.current = ws
    }

    // Create session when spotlight opens
    useEffect(() => {
        const initSpotlightSession = async () => {
            if (!accessToken || !isOpen || sessionId) return

            try {
                const baseUrl = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'
                const response = await fetch(`${baseUrl}/api/v1/chat/sessions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ context_type: 'BUSINESS_CHAT' })
                })

                if (response.ok) {
                    const data = await response.json()
                    const newSessionId = data.session_id
                    setSessionId(newSessionId)
                    connectWebSocket(newSessionId)
                }
            } catch (error) {
                console.error('[Spotlight] Failed to create session:', error)
            }
        }

        if (isOpen && !sessionId) {
            initSpotlightSession()
        }
    }, [isOpen, accessToken, sessionId])

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

    // Clear messages when spotlight closes (but keep session for sidebar)
    useEffect(() => {
        if (!isOpen) {
            setMessages([])
        }
    }, [isOpen, setMessages])

    // Handle global hotkey
    useGlobalHotkey({
        enabled: true,
        onTrigger: () => {
            if (isOpen) {
                close()
            } else {
                if (!isVIP && !loadingMembership) {
                    showToast('error', 'Tính năng trợ lý AI (Spotlight) yêu cầu gói hội viên VIP.')
                    return
                }
                open()
            }
        }
    })

    // Listen for action confirmations from SpotlightModal
    useEffect(() => {
        const handleActionConfirm = (event: CustomEvent<AIAction>) => {
            const action = event.detail

            console.log('Spotlight action confirmed:', action)

            switch (action.type) {
                case 'emr_create':
                    if (action.data.petId) {
                        navigate(`/staff/emr/create/${action.data.petId}`)
                    }
                    break
                case 'emr_edit':
                    if (action.data.emrId) {
                        navigate(`/staff/emr/edit/${action.data.emrId}`)
                    }
                    break
                case 'patient_info':
                    if (action.data.petId) {
                        navigate(`/staff/patients/${action.data.petId}`)
                    }
                    break
                default:
                    console.log('Unhandled action:', action)
            }
        }

        window.addEventListener('spotlight-action-confirm', handleActionConfirm as EventListener)
        return () => {
            window.removeEventListener('spotlight-action-confirm', handleActionConfirm as EventListener)
        }
    }, [navigate])

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

        // Add user message to store (will show in both Spotlight and Sidebar)
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
                ...additionalContext
            }))
            console.log('[Spotlight] Sent via existing WebSocket')
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

    return (
        <>
            {children}

            <SpotlightModal
                isOpen={isOpen}
                onClose={close}
                position={position || undefined}
                onSendMessage={handleSendMessage}
                initialContext={context || undefined}
                messages={messages}
                connectionStatus={connectionStatus}
            />
        </>
    )
}

export default SpotlightProvider
