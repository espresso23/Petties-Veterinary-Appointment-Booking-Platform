import { useEffect, useRef } from 'react'
import { useGlobalHotkey } from '../../hooks/useGlobalHotkey'
import { useSpotlight } from '../../hooks/useSpotlight'
import { SpotlightModal, type AIAction } from './SpotlightModal'
import { useAuthStore } from '../../store/authStore'
import { useAIChatStore } from '../../store/aiChatStore'
import { useNavigate } from 'react-router-dom'

interface SpotlightProviderProps {
    children: React.ReactNode
}

export const SpotlightProvider = ({ children }: SpotlightProviderProps) => {
    const navigate = useNavigate()
    const { isOpen, position, context, open, close } = useSpotlight()
    const accessToken = useAuthStore((state) => state.accessToken)
    
    const { 
        sessionId, 
        messages, 
        connectionStatus,
        setSessionId, 
        setMessages, 
        addMessage,
        updateLastMessage,
        setConnectionStatus,
        setIsOpen: setStoreIsOpen
    } = useAIChatStore()

    const wsRef = useRef<WebSocket | null>(null)
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
        }

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                console.log('[Spotlight] WebSocket message:', data)

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
            timestamp: new Date()
        })

        // Send via WebSocket - use existing connection if available
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                message,
                ...additionalContext
            }))
            console.log('[Spotlight] Sent via existing WebSocket')
        } else {
            // If no WebSocket, try REST as fallback (won't trigger AI but will save message)
            console.log('[Spotlight] No WebSocket, trying REST...')
            try {
                const baseUrl = import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'
                await fetch(`${baseUrl}/api/v1/chat/sessions/${sessionId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify({ 
                        message,
                        ...additionalContext
                    })
                })
            } catch (error) {
                console.error('[Spotlight] Failed to send message:', error)
            }
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
