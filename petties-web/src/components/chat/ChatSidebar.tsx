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
    ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { ChatbotUI, type ChatMessage } from './ChatbotUI'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../../hooks/useToast'
import { useAIChatStore, type AISessionMessage } from '../../store/aiChatStore'
import { AIDiagnosisPanel } from '../emr/AIDiagnosisPanel'
import { saveEmrAiDraft } from '../../utils/emrAiDraftBridge'

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
    react_trace?: Array<{
        step_type?: 'thought' | 'action' | 'observation'
        content?: string
        tool_name?: string
        tool_params?: Record<string, unknown>
        tool_result?: unknown
    }>
}

interface ChatSidebarProps {
    title?: string
    placeholder?: string
    isVIP?: boolean
}

const QUICK_ACTIONS = [
    { label: 'Tạo EMR mới', icon: DocumentTextIcon, prompt: 'Tạo EMR cho thú cưng' },
    { label: 'Xem thú cưng', icon: UserGroupIcon, prompt: 'Liệt kê thú cưng của phòng khám' },
    { label: 'Xem lịch hẹn', icon: CalendarIcon, prompt: 'Hiển thị lịch hẹn hôm nay' },
    { label: 'Chẩn đoán bệnh', icon: PencilIcon, prompt: 'Hỗ trợ chẩn đoán bệnh' },
]

const SUGGESTED_PROMPTS = [
    'Thú cưng nào đến khám hôm nay?',
    'Tạo EMR cho bé chó mèo',
    'Lịch hẹn trong tuần này',
    'Hướng dẫn chăm sóc thú cưng sau tiêm',
]

export const ChatSidebar = ({
    title = 'Trợ lý AI',
    placeholder = 'Nhập tin nhắn...',
    isVIP = false,
}: ChatSidebarProps) => {
    const navigate = useNavigate()
    const [sessions, setSessions] = useState<ChatSession[]>([])
    const [showSessionList, setShowSessionList] = useState(false)
    const [isLoadingSessions, setIsLoadingSessions] = useState(false)
    const [isCreatingSession, setIsCreatingSession] = useState(false)
    const wsRef = useRef<WebSocket | null>(null)
    const isMountedRef = useRef(true)
    const { showToast } = useToast()

    const accessToken = useAuthStore((state) => state.accessToken)
    const userRole = useAuthStore((state) => state.user?.role)
    const canUpgrade = userRole === 'CLINIC_OWNER'
    const upgradePath = canUpgrade ? '/clinic-owner/subscriptions' : null

    const {
        sessionId,
        messages: storeMessages,
        isOpen,
        emrDraft,
        setSessionId,
        setMessages,
        addMessage,
        updateLastMessage,
        appendThinkingToLastMessage,
        appendToolCallToLastMessage,
        attachToolResultToLastMessage,
        setConnectionStatus,
        setIsOpen,
        updateEmrDraftField,
    } = useAIChatStore()

    const toggle = useCallback(() => setIsOpen(!isOpen), [isOpen, setIsOpen])
    const close = useCallback(() => setIsOpen(false), [setIsOpen])

    const messages: ChatMessage[] = storeMessages.map((msg: AISessionMessage) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        isLoading: msg.isLoading ?? false,
        images: msg.images,
        thinkingProcess: msg.thinkingProcess,
        toolCalls: msg.toolCalls,
    }))

    useEffect(() => {
        if (emrDraft) {
            saveEmrAiDraft(emrDraft)
        }
    }, [emrDraft])

    // Track mounted state to prevent state updates after unmount
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
        }
    }, [])

    const loadSessions = useCallback(async () => {
        if (!accessToken) return

        setIsLoadingSessions(true)
        try {
            const response = await fetch(
                `${import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'}/api/v1/chat/sessions?limit=20`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
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

    const createNewSession = useCallback(async () => {
        if (!accessToken || isCreatingSession) return

        setIsCreatingSession(true)
        try {
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
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        context_type: 'BUSINESS_CHAT',
                    }),
                }
            )

            if (response.ok) {
                const data = await response.json()
                setSessionId(data.session_id)
                setMessages([])
                setShowSessionList(false)
                await loadSessions()
            }
        } catch (error) {
            console.error('Failed to create session:', error)
            showToast('error', 'Không thể tạo cuộc chat mới')
        } finally {
            setIsCreatingSession(false)
        }
    }, [accessToken, isCreatingSession, loadSessions, setMessages, setSessionId, showToast])

    const deleteSession = useCallback(async (sessionIdToDelete: string) => {
        if (!accessToken) return

        try {
            const response = await fetch(
                `${import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'}/api/v1/chat/sessions/${sessionIdToDelete}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            )

            if (response.ok) {
                showToast('success', 'Đã xóa cuộc chat')

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
    }, [accessToken, createNewSession, loadSessions, sessionId, showToast])

    const selectSession = useCallback(async (selectedSessionId: string) => {
        if (!accessToken) return

        if (wsRef.current) {
            wsRef.current.close()
            wsRef.current = null
        }

        try {
            const response = await fetch(
                `${import.meta.env.VITE_AGENT_API_BASE_URL || 'http://localhost:8000'}/api/v1/chat/sessions/${selectedSessionId}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            )

            if (response.ok) {
                const data = await response.json()
                setSessionId(data.session_id)

                const convertedMessages: AISessionMessage[] = (data.messages || []).map((msg: ChatSessionMessage) => {
                    const thinkingProcess: string[] = []
                    const toolCalls: Array<{ tool: string; input: unknown; output?: unknown }> = []

                    if (msg.role !== 'user' && msg.react_trace) {
                        msg.react_trace.forEach((step) => {
                            if (step.step_type === 'thought' && step.content) {
                                thinkingProcess.push(step.content)
                            } else if (step.step_type === 'action' && step.tool_name) {
                                toolCalls.push({
                                    tool: step.tool_name,
                                    input: step.tool_params || {},
                                    output: undefined,
                                })
                            } else if (step.step_type === 'observation' && toolCalls.length > 0) {
                                toolCalls[toolCalls.length - 1].output = step.tool_result
                            }
                        })
                    }

                    return {
                        id: msg.message_id || Date.now().toString(),
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                        thinkingProcess,
                        toolCalls,
                    }
                })

                setMessages(convertedMessages)
                setShowSessionList(false)
            }
        } catch (error) {
            console.error('Failed to load session:', error)
            showToast('error', 'Không thể tải cuộc chat')
        }
    }, [accessToken, setMessages, setSessionId, showToast])

    useEffect(() => {
        if (accessToken && isOpen) {
            void loadSessions()
            if (!sessionId) {
                void createNewSession()
            }
        }
    }, [accessToken, createNewSession, isOpen, loadSessions, sessionId])

    useEffect(() => {
        if (!sessionId || !accessToken) return

        const AGENT_WS_BASE_URL = import.meta.env.VITE_AGENT_WS_BASE_URL || 'ws://localhost:8000'

        if (wsRef.current) {
            wsRef.current.close()
        }

        const wsUrl = `${AGENT_WS_BASE_URL}/ws/chat/${sessionId}?token=${accessToken}`
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
            if (!isMountedRef.current) return
            setConnectionStatus('connected')
        }

        ws.onmessage = (event) => {
            if (!isMountedRef.current) return
            try {
                const data = JSON.parse(event.data)

                if (data.type === 'session_established' || data.type === 'ack' || data.type === 'agent_info') {
                    return
                }

                if (data.type === 'thinking' || data.type === 'thinking_stream') {
                    if (!isMountedRef.current) return
                    const content = data.content || ''
                    if (content) {
                        appendThinkingToLastMessage(content)
                        updateLastMessage(content, true)
                    }
                    return
                }

                if (data.type === 'tool_call') {
                    if (!isMountedRef.current) return
                    appendToolCallToLastMessage(data.tool_name || 'unknown', data.tool_params || {})
                    return
                }

                if (data.type === 'tool_result') {
                    if (!isMountedRef.current) return
                    attachToolResultToLastMessage(data.tool_name, data.result)
                    return
                }

                if (data.type === 'stream' || data.type === 'final') {
                    if (!isMountedRef.current) return
                    const content = data.content || data.full_response || ''
                    if (content) {
                        updateLastMessage(content, false)
                    }
                    return
                }

                if (data.type === 'complete') {
                    if (!isMountedRef.current) return
                    const content = data.full_response || data.content || ''
                    if (content) {
                        updateLastMessage(content, false)
                    }
                    return
                }

                if (data.type === 'error') {
                    if (!isMountedRef.current) return
                    addMessage({
                        id: `error-${Date.now()}`,
                        role: 'assistant',
                        content: `Lỗi: ${data.error}`,
                        timestamp: new Date(),
                    })
                }
            } catch (err) {
                console.error('[ChatSidebar] Failed to parse WS message:', err)
            }
        }

        ws.onerror = () => {
            if (!isMountedRef.current) return
            setConnectionStatus('disconnected')
        }

        ws.onclose = () => {
            if (!isMountedRef.current) return
            setConnectionStatus('disconnected')
        }

        wsRef.current = ws

        return () => {
            if (wsRef.current) {
                wsRef.current.close()
                wsRef.current = null
            }
        }
    }, [
        accessToken,
        addMessage,
        appendThinkingToLastMessage,
        appendToolCallToLastMessage,
        attachToolResultToLastMessage,
        sessionId,
        setConnectionStatus,
        updateLastMessage,
    ])

    const handleSendMessage = useCallback(async (message: string, images?: string[]) => {
        if (!message.trim() && (!images || images.length === 0)) {
            return {}
        }

        const hasImages = images && images.length > 0

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            showToast('error', 'Kết nối chat chưa sẵn sàng')
            return {}
        }

        if (hasImages) {
            return { processingStatus: 'Đang phân tích ảnh...' }
        }

        addMessage({
            id: Date.now().toString(),
            role: 'user',
            content: message,
            timestamp: new Date(),
            images,
        })

        addMessage({
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            isLoading: true,
            thinkingProcess: [],
            toolCalls: [],
        })

        wsRef.current.send(JSON.stringify({ message, images }))
        return {}
    }, [addMessage, showToast])

    const handleQuickAction = (prompt: string) => {
        void handleSendMessage(prompt)
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

    const emrContextPanel = emrDraft ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-stone-900">Bệnh án đang soạn</h3>
                <p className="text-[11px] text-stone-600">Tương tác trực tiếp với EMR ngay trong hội thoại AI.</p>
            </div>

            <div className="space-y-2">
                <textarea
                    value={emrDraft.subjective}
                    onChange={(e) => updateEmrDraftField('subjective', e.target.value)}
                    rows={2}
                    placeholder="Subjective"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 focus:border-amber-500 focus:outline-none"
                />
                <textarea
                    value={emrDraft.objective}
                    onChange={(e) => updateEmrDraftField('objective', e.target.value)}
                    rows={2}
                    placeholder="Objective"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 focus:border-amber-500 focus:outline-none"
                />
                <textarea
                    value={emrDraft.assessment}
                    onChange={(e) => updateEmrDraftField('assessment', e.target.value)}
                    rows={2}
                    placeholder="Assessment"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 focus:border-amber-500 focus:outline-none"
                />
                <textarea
                    value={emrDraft.plan}
                    onChange={(e) => updateEmrDraftField('plan', e.target.value)}
                    rows={2}
                    placeholder="Plan"
                    className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700 focus:border-amber-500 focus:outline-none"
                />
            </div>

            <div className="mt-4">
                <AIDiagnosisPanel
                    petId={emrDraft.pet_id}
                    bookingId={emrDraft.booking_id}
                    species={emrDraft.species}
                    breed={emrDraft.breed}
                    ageMonths={emrDraft.age_months}
                    weightKg={emrDraft.weight_kg}
                    allergies={emrDraft.allergies}
                    subjective={emrDraft.subjective}
                    objective={emrDraft.objective}
                    assessment={emrDraft.assessment}
                    plan={emrDraft.plan}
                    imageUrls={emrDraft.image_urls}
                />
            </div>
        </div>
    ) : null

    return (
        <>
            <button
                onClick={toggle}
                className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-10 h-16 bg-amber-500 border-y-2 border-l-2 border-stone-900 shadow-[-3px_3px_0_#1c1917] hover:bg-amber-600 transition-all duration-300 rounded-l-lg"
            >
                {isOpen ? (
                    <ChevronRightIcon className="w-5 h-5 text-white" />
                ) : (
                    <SparklesIcon className="w-5 h-5 text-white" />
                )}
            </button>

            <div
                className={`fixed right-0 top-0 z-30 h-full w-[420px] transition-transform duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="flex h-full flex-col border-l-2 border-stone-900 bg-white shadow-[-4px_4px_0_#1c1917]">
                    <div className="min-w-0 flex flex-1 flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-stone-900 bg-amber-500">
                            <div className="flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5 text-white" />
                                <h2 className="text-lg font-black text-white uppercase tracking-wide">{title}</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowSessionList(!showSessionList)}
                                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                    title="Danh sách chat"
                                >
                                    <FolderIcon className="w-5 h-5 text-white" />
                                </button>
                                <button onClick={close} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                                    <ChevronRightIcon className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>

                        {showSessionList && (
                            <div className="border-b-2 border-stone-900 bg-stone-50">
                                <div className="flex items-center justify-between px-4 py-2 border-b border-stone-200">
                                    <span className="text-sm font-bold text-stone-700">Danh sách cuộc chat</span>
                                    <button
                                        onClick={() => void createNewSession()}
                                        disabled={isCreatingSession}
                                        className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white text-xs font-bold rounded border border-stone-900 shadow-[1px_1px_0_#1c1917] hover:bg-amber-600 disabled:opacity-50"
                                    >
                                        {isCreatingSession ? <ArrowPathIcon className="w-3 h-3 animate-spin" /> : <PlusIcon className="w-3 h-3" />}
                                        Chat mới
                                    </button>
                                </div>

                                <div className="max-h-[200px] overflow-y-auto">
                                    {isLoadingSessions ? (
                                        <div className="p-4 text-center text-stone-500 text-sm">Đang tải...</div>
                                    ) : sessions.length === 0 ? (
                                        <div className="p-4 text-center text-stone-500 text-sm">Chưa có cuộc chat nào</div>
                                    ) : (
                                        sessions.map((session) => (
                                            <div
                                                key={session.session_id}
                                                className={`flex items-center justify-between px-4 py-2 border-b border-stone-100 hover:bg-stone-100 cursor-pointer ${
                                                    session.session_id === sessionId ? 'bg-amber-50' : ''
                                                }`}
                                                onClick={() => void selectSession(session.session_id)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-stone-800 truncate">
                                                        {session.title || 'Cuộc chat mới'}
                                                    </p>
                                                    <p className="text-xs text-stone-500">{formatDate(session.created_at)}</p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        void deleteSession(session.session_id)
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

                        <div className="relative flex-1 overflow-hidden flex flex-col">
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
                                contextPanel={emrContextPanel}
                            />

                            {!isVIP && (
                                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/90 p-8 text-center backdrop-blur-[2px]">
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-100 shadow-[4px_4px_0_0_#1c1917]">
                                        <SparklesIcon className="h-8 w-8 text-amber-600" />
                                    </div>
                                    <h3 className="mb-2 text-xl font-black uppercase leading-tight text-stone-900">Yêu cầu hội viên</h3>
                                    <p className="mb-8 text-sm font-medium text-stone-600">
                                        Trợ lý AI chỉ dành cho phòng khám có gói hội viên đang hoạt động.
                                    </p>

                                    {upgradePath ? (
                                        <button
                                            onClick={() => {
                                                close()
                                                navigate(upgradePath)
                                            }}
                                            className="w-full border-2 border-stone-900 bg-amber-500 py-3 font-black uppercase tracking-widest text-stone-950 shadow-[4px_4px_0_0_#1c1917] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#1c1917]"
                                        >
                                            Nâng cấp ngay
                                        </button>
                                    ) : (
                                        <div className="rounded-lg border-2 border-stone-900 bg-stone-100 px-4 py-3 text-xs font-bold uppercase tracking-tight text-stone-500">
                                            Vui lòng liên hệ chủ phòng khám để kích hoạt AI
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="fixed inset-0 bg-black/20 z-20" onClick={close} />
            )}
        </>
    )
}

export default ChatSidebar

