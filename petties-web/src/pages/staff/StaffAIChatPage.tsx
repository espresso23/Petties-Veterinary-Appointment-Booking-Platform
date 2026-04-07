import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useToast, type ToastType } from '../../components/Toast'
import { chatApi, createChatWebSocket, feedbackApi, type ChatContextType, type ChatSessionMessage, type ChatSessionSummary } from '../../services/agentService'
import { ChatMessage } from '../../components/admin/ChatMessage'
import { AIDiagnosisPanel } from '../../components/emr/AIDiagnosisPanel'
import {
  createEmptyEmrAiDraft,
  loadEmrAiDraft,
  saveEmrAiDraft,
  type EmrAiDraft,
  type EmrAiSoapField,
} from '../../utils/emrAiDraftBridge'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  PhotoIcon,
  XMarkIcon,
  SparklesIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { useMembershipStore } from '../../store/membershipStore'
import type { ChatStage, UIAction, UISchemaV1 } from '../../types/chat-copilot'

const MAX_IMAGES = 3
const MAX_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  images?: string[]
  thinkingProcess?: string[]
  toolCalls?: Array<{ tool: string; input: unknown; output?: unknown }>
  feedback?: 'good' | 'bad' | null
  isStreaming?: boolean
  uiSchema?: UISchemaV1
  stage?: ChatStage
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_INTERVAL_MS = 2000
const WEBSOCKET_OPEN_STATE = typeof WebSocket !== 'undefined' && typeof WebSocket.OPEN === 'number' ? WebSocket.OPEN : 1
const WEBSOCKET_CONNECTING_STATE = typeof WebSocket !== 'undefined' && typeof WebSocket.CONNECTING === 'number' ? WebSocket.CONNECTING : 0

interface SessionInfo {
  sessionId: string
  contextType: ChatContextType
  createdAt: string
  userRole: string
  clinicId?: string | null
}

interface ImageUpload {
  file: File
  preview: string
  base64: string
}

const looksLikeJsonPayload = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  const text = value.trim()
  if (!text) return false
  if (!(text.startsWith('{') || text.startsWith('['))) return false
  return (
    text.includes('"success"') ||
    text.includes('"data"') ||
    text.includes('"suggestions"') ||
    text.includes('"error_code"') ||
    text.includes('"ui_card"')
  )
}

const parseAgeMonths = (value?: string | null): number | undefined => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const StaffAIChatPage = () => {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emrBridgeEnabled = searchParams.get('emrBridge') === '1'
  const returnTo = searchParams.get('returnTo')

  // Membership state
  const isVIP = useMembershipStore(state => state.isVIP())
  const planName = useMembershipStore(state => state.getPlanName())
  const loadingMembership = useMembershipStore(state => state.isLoading)
  const user = useAuthStore(state => state.user)

  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null)
  const manualDisconnectRef = useRef(false)
  const expectedSessionIdRef = useRef<string | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionList, setSessionList] = useState<ChatSessionSummary[]>([])

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [liveReasoning, setLiveReasoning] = useState('')
  const [, setReactSteps] = useState<Array<{
    step_index: number
    step_type: 'thought' | 'action' | 'observation'
    content?: string
    tool_name?: string
    tool_params?: Record<string, unknown>
    tool_result?: unknown
    timestamp?: string
  }>>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Image Upload state
  const [selectedImages, setSelectedImages] = useState<ImageUpload[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [bridgeDraft, setBridgeDraft] = useState<EmrAiDraft>(() => {
    const stored = loadEmrAiDraft()
    if (stored) return stored
    return {
      ...createEmptyEmrAiDraft(),
      pet_id: searchParams.get('petId') ?? undefined,
      booking_id: searchParams.get('bookingId') ?? undefined,
      age_months: parseAgeMonths(searchParams.get('ageMonths')),
    }
  })

  // ==================== HELPER ====================
  const handleApiError = (err: unknown, toast: { showToast: (type: ToastType, message: string) => void }, fallbackMessage: string) => {
    const errorData = (err as { response?: { data?: unknown } })?.response?.data
    let message = fallbackMessage
    if (errorData && typeof errorData === 'object' && 'detail' in errorData) {
      const detail = (errorData as { detail: unknown }).detail
      message = typeof detail === 'string' ? detail : JSON.stringify(detail)
    } else if (err instanceof Error) {
      message = err.message
    }
    toast.showToast('error', message)
  }

  const updateBridgeField = (field: EmrAiSoapField, value: string) => {
    setBridgeDraft((prev) => ({ ...prev, [field]: value, updated_at: new Date().toISOString() }))
  }

  const handleApplyBridgeDraft = (draft: {
    subjective_draft: string
    objective_draft: string
    assessment_draft: string
    plan_draft: string
  }) => {
    if (draft.subjective_draft?.trim()) updateBridgeField('subjective', draft.subjective_draft)
    if (draft.objective_draft?.trim()) updateBridgeField('objective', draft.objective_draft)
    if (draft.assessment_draft?.trim()) updateBridgeField('assessment', draft.assessment_draft)
    if (draft.plan_draft?.trim()) updateBridgeField('plan', draft.plan_draft)
    toast.showToast('success', 'Đã cập nhật bản nháp EMR từ AI')
  }

  const handleSyncBridgeFromStorage = useCallback(() => {
    const stored = loadEmrAiDraft()
    if (!stored) return
    setBridgeDraft(stored)
    toast.showToast('success', 'Đã đồng bộ bản nháp EMR mới nhất.')
  }, [toast])

  // Parse history messages to UI format
  const mapHistoryMessage = useCallback((msg: ChatSessionMessage): Message => {
    const isUser = msg.role === 'user'

    // Extract thoughts and tool calls from react_trace
    const thoughts: string[] = []
    const toolCalls: Array<{ tool: string; input: unknown; output?: unknown }> = []

    if (!isUser && msg.react_trace) {
      msg.react_trace.forEach(step => {
        if (step.step_type === 'thought' && step.content) {
          thoughts.push(step.content)
        } else if (step.step_type === 'action' && step.tool_name) {
          toolCalls.push({
            tool: step.tool_name,
            input: step.tool_params || {},
            output: null // Observation comes next
          })
        } else if (step.step_type === 'observation' && step.tool_result) {
          if (toolCalls.length > 0) {
            toolCalls[toolCalls.length - 1].output = step.tool_result
          }
        }
      })
    }

    let extractedImages: string[] = []
    if (msg.metadata && msg.metadata.images && Array.isArray(msg.metadata.images)) {
      extractedImages = msg.metadata.images.map((img: unknown) => {
        if (typeof img === 'string') return img
        const imgObj = img as { url?: string }
        return imgObj.url || ''
      })
    }

    return {
      id: msg.message_id || crypto.randomUUID(),
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      thinkingProcess: thoughts,
      toolCalls: toolCalls,
      images: extractedImages,
      feedback: null
    }
  }, [])

  // ==================== SESSION MANAGEMENT ====================

  const disconnectWebSocket = useCallback(() => {
    manualDisconnectRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    expectedSessionIdRef.current = null
    setConnectionStatus('disconnected')
    reconnectAttemptsRef.current = 0
    setReconnectAttempts(0)
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true)
      const response = await chatApi.listSessions('BUSINESS_CHAT', 20)
      setSessionList(response.sessions)
    } catch (err) {
      handleApiError(err, toast, 'Không thể tải danh sách cuộc chat')
    } finally {
      setLoadingSessions(false)
    }
  }, [toast])

  const handleSelectSession = useCallback(async (sessionId: string) => {
    try {
      disconnectWebSocket()
      setStreamingContent('')
      setSending(false)
      setReactSteps([])

      const session = await chatApi.getSession(sessionId)
      setSessionInfo({
        sessionId: session.session_id,
        contextType: session.context_type,
        createdAt: session.created_at || new Date().toISOString(),
        userRole: session.user_role || 'STAFF',
        clinicId: session.clinic_id,
      })
      setMessages(session.messages.map(mapHistoryMessage))
    } catch (err) {
      handleApiError(err, toast, 'Không thể mở cuộc chat đã chọn')
    }
  }, [disconnectWebSocket, mapHistoryMessage, toast])

  const sendUiAction = useCallback((action: UIAction) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.showToast('error', 'Kết nối chat chưa sẵn sàng')
      return
    }

    const bookingParams =
      action.type === 'confirm_booking' &&
      action.payload &&
      typeof action.payload['booking_params'] === 'object' &&
      action.payload['booking_params'] !== null
        ? action.payload['booking_params'] as Record<string, unknown>
        : null

    const payload = {
      type: action.type,
      ...(bookingParams ?? action.payload ?? {}),
    }

    wsRef.current.send(JSON.stringify({ message: '', ui_action: payload }))
    setSending(true)
    setStreamingContent('')
  }, [toast])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  useEffect(() => {
    if (!emrBridgeEnabled) return
    const stored = loadEmrAiDraft()
    if (stored) {
      setBridgeDraft(stored)
      return
    }
    setBridgeDraft((prev) => ({
      ...prev,
      pet_id: searchParams.get('petId') ?? prev.pet_id,
      booking_id: searchParams.get('bookingId') ?? prev.booking_id,
      age_months: parseAgeMonths(searchParams.get('ageMonths')) ?? prev.age_months,
    }))
  }, [emrBridgeEnabled, searchParams])

  useEffect(() => {
    if (!emrBridgeEnabled) return
    saveEmrAiDraft(bridgeDraft)
  }, [bridgeDraft, emrBridgeEnabled])

  const createSession = useCallback(async () => {
    if (creatingSession) return

    try {
      setCreatingSession(true)
      disconnectWebSocket()
      setConnectionStatus('connecting')

      const session = await chatApi.createSession({
        title: `Tư vấn ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
        context_type: 'BUSINESS_CHAT',
      })

      setSessionInfo({
        sessionId: session.session_id,
        contextType: session.context_type,
        createdAt: session.created_at,
        userRole: session.user_role,
        clinicId: session.clinic_id,
      })
      setMessages([])
      setReactSteps([])
      setStreamingContent('')
      await loadSessions()

    } catch (err) {
      handleApiError(err, toast, 'Không thể tạo cuộc chat mới')
      setConnectionStatus('disconnected')
    } finally {
      setCreatingSession(false)
    }
  }, [creatingSession, disconnectWebSocket, loadSessions, toast])


  // ==================== WEBSOCKET ====================

  const handleWebSocketMessage = useCallback((data: {
    type: string
    session_id?: string
    context_type?: ChatContextType
    messages?: ChatSessionMessage[]
    content?: string
    step_index?: number
    tool_name?: string
    tool_params?: Record<string, unknown>
    result?: unknown
    full_response?: string
    react_trace?: Array<{
      step_index: number
      step_type: 'thought' | 'action' | 'observation'
      content?: string
      tool_name?: string
      tool_params?: Record<string, unknown>
      tool_result?: unknown
    }>
    error?: string
    error_code?: string
    recoverable?: boolean
    suggestion?: string
    ui_schema?: UISchemaV1
    stage?: ChatStage
  }) => {
    switch (data.type) {
      case 'connected':
        console.log('WebSocket session established')
        break
      case 'history': {
        // Prevent duplicate history by checking if we already have messages from this session
        const newMessages = (data.messages || []).map(mapHistoryMessage)
        setMessages(prev => {
          // Only update if the new messages are different (prevent duplicates)
          if (prev.length === 0 || JSON.stringify(prev) !== JSON.stringify(newMessages)) {
            return newMessages
          }
          return prev
        })
        setStreamingContent('')
        setLiveReasoning('')
        setSending(false)
        break
      }
      case 'ack':
        setStreamingContent('')
        setLiveReasoning('Đang suy luận: mình đã nhận yêu cầu và bắt đầu xử lý.')
        setReactSteps([])
        break
      case 'agent_info':
        break
      case 'thinking_stream':
        setSending(true)
        setLiveReasoning(data.content ?? 'Đang suy luận: mình đang phân tích yêu cầu của bạn.')
        break
      case 'thinking':
        setSending(true)
        setLiveReasoning(data.content ?? 'Đang suy luận: mình đang phân tích yêu cầu của bạn.')
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'thought',
            content: data.content ?? '',
            tool_name: data.tool_name,
          tool_params: data.tool_params,
          timestamp: new Date().toISOString()
        }])
        break
      case 'tool_call':
        setSending(true)
        if (data.content?.trim()) {
          setLiveReasoning(data.content)
        }
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'action',
          content: data.content ?? `Calling ${data.tool_name}`,
          tool_name: data.tool_name,
          tool_params: data.tool_params,
          timestamp: new Date().toISOString()
        }])
        break
      case 'tool_result':
        setSending(true)
        if (data.content?.trim()) {
          setLiveReasoning(data.content)
        }
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'observation',
          content: data.content ?? 'Tool result received',
          tool_name: data.tool_name,
          tool_result: data.result,
          timestamp: new Date().toISOString()
        }])
        break
      case 'ui_schema':
        setMessages(prev => [...prev, {
          id: `ui-${Date.now()}`,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          uiSchema: data.ui_schema,
          stage: data.stage,
        }])
        break
      case 'stream':
        setLiveReasoning('')
        setStreamingContent(prev => prev + (data.content ?? ''))
        break
      case 'complete': {
        setSending(false)
        setStreamingContent('')
        setLiveReasoning('')
        const thinkingProcess: string[] = []
        const toolCalls: Array<{ tool: string; input: unknown; output?: unknown }> = []

        if (data.react_trace) {
          for (const step of data.react_trace) {
            if (step.step_type === 'thought' && step.content) thinkingProcess.push(step.content)
            if (step.step_type === 'action' && step.tool_name) {
              toolCalls.push({ tool: step.tool_name, input: step.tool_params ?? {}, output: undefined })
            }
            if (step.step_type === 'observation' && toolCalls.length > 0) {
              toolCalls[toolCalls.length - 1].output = step.tool_result
            }
          }
        }
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last && last.role === 'assistant' && last.uiSchema && !last.content.trim()) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: looksLikeJsonPayload(data.full_response)
                  ? ''
                  : (data.full_response ?? ''),
                timestamp: new Date(),
                thinkingProcess,
                toolCalls,
              }
            ]
          }

          return [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: looksLikeJsonPayload(data.full_response)
              ? ''
              : (data.full_response ?? ''),
            timestamp: new Date(),
            thinkingProcess,
            toolCalls
          }]
        })
        break
      }
      case 'error':
        setSending(false)
        setStreamingContent('')
        setLiveReasoning('')
        {
          const errorCode = data.error_code ? ` (${data.error_code})` : ''
          const suggestion = data.suggestion ? ` ${data.suggestion}` : ''
          const recoverable = data.recoverable === false ? ' Không thể tự khôi phục.' : ''
          const errorMessage = `[Lỗi${errorCode}] ${data.error ?? 'Unknown error'}${suggestion}${recoverable}`
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorMessage,
          timestamp: new Date()
        }])
        }
        break
    }
  }, [mapHistoryMessage])

  const connectWebSocket = useCallback((sessionId: string, contextType: ChatContextType) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (
      wsRef.current?.readyState === WEBSOCKET_OPEN_STATE ||
      wsRef.current?.readyState === WEBSOCKET_CONNECTING_STATE
    ) return

    manualDisconnectRef.current = false
    setConnectionStatus('connecting')
    const ws = createChatWebSocket(sessionId, contextType)

    ws.onopen = () => {
      setConnectionStatus('connected')
      reconnectAttemptsRef.current = 0
      setReconnectAttempts(0)
    }

    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null

      if (manualDisconnectRef.current || expectedSessionIdRef.current !== sessionId) {
        setConnectionStatus('disconnected')
        return
      }

      // Auto-reconnect if within retry limit
      const nextAttempt = reconnectAttemptsRef.current + 1
      if (nextAttempt <= MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current = nextAttempt
        setReconnectAttempts(nextAttempt)
        console.log(`WebSocket closed, auto-reconnecting (${nextAttempt}/${MAX_RECONNECT_ATTEMPTS})...`)
        setConnectionStatus('connecting')
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(sessionId, contextType)
        }, RECONNECT_INTERVAL_MS)
      } else {
        setConnectionStatus('disconnected')
      }
    }

    ws.onerror = () => setConnectionStatus('error')

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }
    wsRef.current = ws
  }, [handleWebSocketMessage])

  useEffect(() => {
    expectedSessionIdRef.current = sessionInfo?.sessionId ?? null
  }, [sessionInfo?.sessionId])

  useEffect(() => {
    if (!sessionInfo?.sessionId) {
      disconnectWebSocket()
      return
    }

    connectWebSocket(sessionInfo.sessionId, sessionInfo.contextType)

    return () => {
      manualDisconnectRef.current = true
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connectWebSocket, disconnectWebSocket, sessionInfo?.contextType, sessionInfo?.sessionId])

  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: messages.length > 0 && messages[messages.length - 1].role === 'user' ? 'auto' : 'smooth'
      })
    }
  }, [messages, streamingContent])

  const sendMessage = async () => {
    if (!isVIP) {
      toast.showToast('error', 'Vui lòng nâng cấp gói hội viên để sử dụng tính năng này.')
      return
    }
    if (!input.trim() || sending || connectionStatus !== 'connected' || !sessionInfo?.sessionId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      images: selectedImages.map(img => img.base64)
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSending(true)
    setReactSteps([])

    const wsPayload: Record<string, unknown> = {
      message: userMessage.content,
    }

    if (selectedImages.length > 0) {
      wsPayload.images = selectedImages.map(img => img.base64)
    }

    wsRef.current?.send(JSON.stringify(wsPayload))
    setSelectedImages([])
  }

  const handleFeedback = async (messageId: string, feedback: 'good' | 'bad') => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback } : msg
    ))

    if (sessionInfo?.sessionId) {
      try {
        await feedbackApi.submitFeedback({
          message_id: messageId,
          session_id: sessionInfo.sessionId,
          feedback_type: feedback === 'good' ? 'thumbs_up' : 'thumbs_down',
        })
      } catch (err) {
        console.error('Failed to save feedback:', err)
      }
    }
  }

  const clearChat = () => {
    setMessages([])
    setReactSteps([])
    setStreamingContent('')
    setSelectedImages([])
  }

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newImages: ImageUpload[] = []

    for (let i = 0; i < Math.min(files.length, MAX_IMAGES - selectedImages.length); i++) {
      const file = files[i]
      if (file.size > MAX_IMAGE_SIZE) {
        toast.showToast('error', `Ảnh ${file.name} quá lớn (tối đa 5MB)`)
        continue
      }
      if (!file.type.startsWith('image/')) {
        toast.showToast('error', `${file.name} không phải file ảnh`)
        continue
      }

      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      newImages.push({
        file,
        preview: URL.createObjectURL(file),
        base64,
      })
    }

    if (newImages.length > 0) {
      setSelectedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES))
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleDeleteSession = useCallback(async (session: ChatSessionSummary) => {
    try {
      await chatApi.deleteSession(session.session_id)
      if (sessionInfo?.sessionId === session.session_id) {
        disconnectWebSocket()
        setSessionInfo(null)
        setMessages([])
        setReactSteps([])
        setStreamingContent('')
        setSending(false)
      }
      setSessionList(prev => prev.filter(s => s.session_id !== session.session_id))
      toast.showToast('success', 'Đã xóa session chat')
    } catch (err) {
      handleApiError(err, toast, 'Không thể xóa session chat')
    }
  }, [disconnectWebSocket, sessionInfo?.sessionId, toast])

  return (
    <div className="h-full min-h-0 bg-stone-50 flex flex-col relative">
      {/* Header */}
      <div className="bg-white border-b-2 border-stone-900 shrink-0">
        <div className="w-full mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <h1 className="text-xl font-black text-stone-900 uppercase tracking-tight">Trợ lý AI</h1>
                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">Tư vấn thú y cho Staff</p>
              </div>
                <div className={`flex items-center gap-1.5 px-2 py-1 border-2 border-stone-900 transition-colors shadow-[1px_1px_0_#1c1917] ${connectionStatus === 'connected' ? 'bg-green-100' :
                  connectionStatus === 'connecting' ? 'bg-yellow-100' :
                    connectionStatus === 'error' ? 'bg-red-100' : 'bg-stone-50'
                }`}>
                {connectionStatus === 'connected' ? (
                  <SparklesIcon className="w-3 h-3 text-green-700" />
                ) : (
                  <ChatBubbleLeftRightIcon className="w-3 h-3 text-stone-400" />
                )}
                <span className="text-[9px] font-black uppercase text-stone-900 tracking-tighter">
                  {connectionStatus === 'connecting' && reconnectAttempts > 0 
                    ? `ket noi lai (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
                    : connectionStatus}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {emrBridgeEnabled && (
                <>
                  <button
                    onClick={handleSyncBridgeFromStorage}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] bg-white text-stone-900 hover:bg-stone-50"
                  >
                    Đồng bộ EMR
                  </button>
                  <button
                    onClick={() => typeof returnTo === 'string' ? navigate(returnTo) : navigate(-1)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] bg-blue-200 text-stone-900 hover:bg-blue-300"
                  >
                    Quay lại EMR
                  </button>
                </>
              )}
              <button
                onClick={() => void createSession()}
                disabled={creatingSession}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] bg-amber-400 text-stone-900 hover:bg-amber-500 disabled:bg-stone-300 disabled:cursor-not-allowed"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {creatingSession ? 'Đang tạo' : 'Chat mới'}
              </button>
              <button
                onClick={clearChat}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] bg-white text-stone-900 hover:bg-stone-50"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Xóa
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Session List Sidebar */}
        <div className="w-64 border-r-2 border-stone-900 bg-white flex flex-col shrink-0">
          <div className="p-3 border-b-2 border-stone-900 bg-stone-100">
            <h2 className="text-xs font-black uppercase text-stone-700">Lịch sử chat</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingSessions ? (
              <div className="p-4 text-center">
                <div className="animate-spin w-6 h-6 border-2 border-stone-900 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-xs font-bold text-stone-500">Đang tải...</p>
              </div>
            ) : sessionList.length === 0 ? (
              <div className="p-4 text-center">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-stone-500">Chưa có cuộc chat nào</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-200">
                {sessionList.map(session => {
                  const isActive = session.session_id === sessionInfo?.sessionId
                  return (
                    <div
                      key={session.session_id}
                      className={`p-3 cursor-pointer transition-colors ${isActive ? 'bg-amber-100 border-l-4 border-amber-500' : 'hover:bg-stone-50 border-l-4 border-transparent'}`}
                      onClick={() => void handleSelectSession(session.session_id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-stone-900 truncate">{session.title || 'Chat mới'}</p>
                          <p className="text-[10px] text-stone-500 mt-1">
                            {session.updated_at ? new Date(session.updated_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Vừa xong'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleDeleteSession(session)
                          }}
                          className="p-1 hover:bg-red-100 rounded text-stone-400 hover:text-red-600 transition-colors"
                          title="Xóa"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
          {/* Messages */}
          <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto p-4 bg-stone-50">
            {!sessionInfo?.sessionId ? (
              <div className="flex items-center justify-center h-full">
                <div className="p-6 bg-white border-4 border-stone-900 shadow-[6px_6px_0_#1c1917] max-w-sm text-center">
                  <div className="w-12 h-12 bg-amber-100 border-2 border-stone-900 flex items-center justify-center mx-auto mb-3">
                    <SparklesIcon className="w-6 h-6 text-stone-700" />
                  </div>
                  <h3 className="text-base font-black text-stone-900 mb-2 uppercase">Chưa có cuộc chat</h3>
                  <p className="text-xs text-stone-600 mb-4">Chọn cuộc chat cũ hoặc tạo cuộc chat mới để bắt đầu</p>
                  <button
                    onClick={() => void createSession()}
                    disabled={creatingSession}
                    className="w-full py-2 bg-blue-300 text-stone-900 border-2 border-stone-900 font-black uppercase text-xs shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50"
                  >
                    Tạo chat mới
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="p-6 bg-white border-4 border-stone-900 shadow-[6px_6px_0_#1c1917] max-w-sm text-center">
                  <div className="w-12 h-12 bg-green-100 border-2 border-stone-900 flex items-center justify-center mx-auto mb-3">
                    <SparklesIcon className="w-6 h-6 text-green-700" />
                  </div>
                  <h3 className="text-base font-black text-stone-900 mb-2 uppercase">Sẵn sàng trò chuyện</h3>
                  <p className="text-xs text-stone-600">Gửi tin nhắn để được tư vấn về thú cưng</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(msg => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                    images={msg.images}
                    feedback={msg.feedback}
                    onFeedback={(feedback) => handleFeedback(msg.id, feedback)}
                    uiSchema={msg.uiSchema}
                    stage={msg.stage}
                    onUiAction={(action: UIAction) => sendUiAction(action)}
                  />
                ))}
                {(sending || streamingContent || liveReasoning) && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] flex items-center justify-center bg-amber-400">
                      <SparklesIcon className="w-4 h-4 text-stone-900 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-start max-w-[80%]">
                      <div className="border-2 border-stone-900 p-3 bg-white text-stone-900 shadow-[3px_3px_0_#1c1917]">
                        <div className="text-sm font-bold whitespace-pre-wrap">
                          {streamingContent || liveReasoning || 'Đang suy luận: mình đang phân tích yêu cầu của bạn.'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t-2 border-stone-900 bg-white">
            {selectedImages.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative">
                    <img src={img.preview} alt={`Preview ${idx + 1}`} className="w-14 h-14 object-cover border-2 border-stone-900 rounded-lg" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white border-2 border-stone-900 rounded-full flex items-center justify-center"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || !sessionInfo?.sessionId || selectedImages.length >= MAX_IMAGES}
                className="p-2 border-2 border-stone-900 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                title="Gửi ảnh"
              >
                <PhotoIcon className="w-5 h-5 text-stone-700" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={sessionInfo?.sessionId ? 'Nhập tin nhắn...' : 'Chọn hoặc tạo chat trước'}
                disabled={!sessionInfo?.sessionId || sending}
                className="flex-1 px-3 py-2 border-2 border-stone-900 font-bold text-sm focus:ring-0 outline-none shadow-[2px_2px_0_#1c1917] focus:shadow-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all disabled:bg-stone-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || connectionStatus !== 'connected' || !sessionInfo?.sessionId}
                className="px-4 py-2 bg-amber-500 text-stone-900 border-2 border-stone-900 font-black uppercase text-sm shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {emrBridgeEnabled && (
          <div className="hidden 2xl:block w-[420px] border-l-2 border-stone-900 bg-stone-50 overflow-y-auto p-4 space-y-4">
            <div className="bg-white border-2 border-stone-900 p-4 shadow-[3px_3px_0_#1c1917]">
              <h3 className="text-xs font-black uppercase text-stone-800 mb-3">Bản nháp EMR từ sidepanel</h3>
              <div className="space-y-2">
                <textarea
                  value={bridgeDraft.subjective}
                  onChange={(e) => updateBridgeField('subjective', e.target.value)}
                  rows={2}
                  placeholder="Subjective"
                  className="w-full border border-stone-300 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500"
                />
                <textarea
                  value={bridgeDraft.objective}
                  onChange={(e) => updateBridgeField('objective', e.target.value)}
                  rows={2}
                  placeholder="Objective"
                  className="w-full border border-stone-300 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500"
                />
                <textarea
                  value={bridgeDraft.assessment}
                  onChange={(e) => updateBridgeField('assessment', e.target.value)}
                  rows={2}
                  placeholder="Assessment"
                  className="w-full border border-stone-300 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500"
                />
                <textarea
                  value={bridgeDraft.plan}
                  onChange={(e) => updateBridgeField('plan', e.target.value)}
                  rows={2}
                  placeholder="Plan"
                  className="w-full border border-stone-300 rounded-lg p-2 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <AIDiagnosisPanel
              petId={bridgeDraft.pet_id}
              bookingId={bridgeDraft.booking_id}
              species={bridgeDraft.species}
              breed={bridgeDraft.breed}
              ageMonths={bridgeDraft.age_months}
              weightKg={bridgeDraft.weight_kg}
              allergies={bridgeDraft.allergies}
              subjective={bridgeDraft.subjective}
              objective={bridgeDraft.objective}
              assessment={bridgeDraft.assessment}
              plan={bridgeDraft.plan}
              imageUrls={bridgeDraft.image_urls}
              onApplyDraft={handleApplyBridgeDraft}
            />
          </div>
        )}
      </div>

      {/* Subscription Guard Overlay */}
      {!isVIP && !loadingMembership && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center backdrop-blur-[2px] bg-stone-900/10">
          <div className="max-w-md w-full mx-4 bg-white border-4 border-stone-900 shadow-[8px_8px_0_0_#1c1917] p-8 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-amber-100 border-4 border-stone-900 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0_0_#1c1917]">
              <SparklesIcon className="w-12 h-12 text-amber-600 animate-pulse" />
            </div>

            <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight mb-3">
              Tính năng Trợ lý AI
            </h2>

            <p className="text-stone-600 font-bold mb-8 leading-relaxed">
              Trợ lý AI chuyên sâu chỉ dành cho phòng khám đã kích hoạt <span className="text-amber-600">Gói Hội Viên (VIP)</span>. Với VIP, bạn có thể:
            </p>

            <div className="space-y-4 mb-8 text-left">
              <div className="flex items-center gap-3 p-3 bg-stone-50 border-2 border-stone-900 rounded-xl shadow-[2px_2px_0_0_#1c1917]">
                <ShieldCheckIcon className="w-6 h-6 text-green-600 shrink-0" />
                <span className="text-xs font-black text-stone-700 uppercase">Tư vấn bệnh lý & Phác đồ điều trị</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-stone-50 border-2 border-stone-900 rounded-xl shadow-[2px_2px_0_0_#1c1917]">
                <SparklesIcon className="w-6 h-6 text-blue-600 shrink-0" />
                <span className="text-xs font-black text-stone-700 uppercase">Tự động phân tích hồ sơ bệnh án</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  if (user?.role === 'CLINIC_OWNER') {
                    navigate('/clinic-owner/subscriptions')
                  } else {
                    toast.showToast('info', 'Vui lòng liên hệ chủ phòng khám để nâng cấp gói hội viên.')
                  }
                }}
                className="w-full py-4 bg-amber-400 hover:bg-amber-500 text-stone-900 border-2 border-stone-900 font-black uppercase text-sm tracking-widest shadow-[4px_4px_0_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBagIcon className="w-5 h-5" />
                {user?.role === 'CLINIC_OWNER' ? 'Nâng cấp ngay' : 'Liên hệ chủ phòng khám'}
              </button>

              <button
                onClick={() => navigate(-1)}
                className="w-full py-3 bg-white hover:bg-stone-50 text-stone-500 border-2 border-stone-900 font-black uppercase text-xs tracking-widest shadow-[3px_3px_0_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
              >
                Quay lại
              </button>
            </div>

            <p className="mt-6 text-[10px] text-stone-400 font-bold uppercase tracking-widest">
              Trạng thái hiện tại: {planName}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffAIChatPage
