import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { chatApi, createChatWebSocket, feedbackApi, type ChatContextType, type ChatSessionMessage, type ChatSessionSummary } from '../../services/agentService'
import { ChatMessage } from '../../components/admin/ChatMessage'
import { ConfirmModal } from '../../components/ConfirmModal'
import {
  PaperAirplaneIcon,
  PlusIcon,
  TrashIcon,
  SparklesIcon,
  ComputerDesktopIcon,
} from '@heroicons/react/24/outline'
import type { UIAction, UISchemaV1 } from '../../types/chat'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_INTERVAL_MS = 2000
const WEBSOCKET_OPEN_STATE = typeof WebSocket !== 'undefined' && typeof WebSocket.OPEN === 'number' ? WebSocket.OPEN : 1

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
  stage?: 'IDLE' | 'COLLECTING' | 'PRESENTING' | 'CONFIRMING' | 'BOOKED'
}

interface PendingConfirmAction {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  action: UIAction
}

interface SessionInfo {
  sessionId: string
  contextType: ChatContextType
  createdAt: string
  userRole: string
  clinicId?: string | null
}

export const ClinicOwnerAIChatPage = () => {
  const toast = useToast()
  const navigate = useNavigate()

  const wsRef = useRef<WebSocket | null>(null)
  const autoBootstrapDoneRef = useRef(false)
  const manualDisconnectRef = useRef(false)
  const expectedSessionIdRef = useRef<string | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionList, setSessionList] = useState<ChatSessionSummary[]>([])

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [liveReasoning, setLiveReasoning] = useState('')
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmAction | null>(null)
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

  const handleApiError = useCallback((err: unknown, fallbackMessage: string) => {
    const errorData = (err as { response?: { data?: unknown } })?.response?.data
    let message = fallbackMessage
    if (errorData && typeof errorData === 'object' && 'detail' in errorData) {
      const detail = (errorData as { detail: unknown }).detail
      message = typeof detail === 'string' ? detail : JSON.stringify(detail)
    } else if (err instanceof Error) {
      message = err.message
    }
    toast.showToast('error', message)
  }, [toast])

  const mapHistoryMessage = useCallback((msg: ChatSessionMessage): Message => {
    const isUser = msg.role === 'user'
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
            output: null
          })
        } else if (step.step_type === 'observation' && step.tool_result) {
          if (toolCalls.length > 0) {
            toolCalls[toolCalls.length - 1].output = step.tool_result
          }
        }
      })
    }

    return {
      id: msg.message_id || crypto.randomUUID(),
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      thinkingProcess: thoughts,
      toolCalls: toolCalls,
      feedback: null,
      uiSchema: msg.metadata?.ui_schema as UISchemaV1 | undefined,
    }
  }, [])

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
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      setLoadingSessions(true)
      const response = await chatApi.listSessions('BUSINESS_CHAT', 20)
      setSessionList(response.sessions)
    } catch (err) {
      handleApiError(err, 'Không thể tải danh sách cuộc chat')
    } finally {
      setLoadingSessions(false)
    }
  }, [handleApiError])

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
        userRole: session.user_role || 'CLINIC_OWNER',
        clinicId: session.clinic_id,
      })
      setMessages(session.messages.map(mapHistoryMessage))
    } catch (err) {
      handleApiError(err, 'Không thể mở cuộc chat đã chọn')
    }
  }, [disconnectWebSocket, handleApiError, mapHistoryMessage])

  const sendUiAction = useCallback((action: UIAction, displayMessage?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WEBSOCKET_OPEN_STATE) {
      toast.showToast('error', 'Kết nối chat chưa sẵn sàng')
      return
    }

    const payload = {
      type: action.type,
      ...action.payload,
    }

    wsRef.current.send(JSON.stringify({ message: '', display_message: displayMessage, ui_action: payload }))
    setSending(true)
    setStreamingContent('')
  }, [toast])

  const createSession = useCallback(async () => {
    if (creatingSession) return

    try {
      setCreatingSession(true)
      disconnectWebSocket()
      setConnectionStatus('connecting')

      const session = await chatApi.createSession({
        title: `Copilot ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
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
      handleApiError(err, 'Không thể tạo cuộc chat mới')
      setConnectionStatus('disconnected')
    } finally {
      setCreatingSession(false)
    }
  }, [creatingSession, disconnectWebSocket, handleApiError, loadSessions])

  const handleUiAction = useCallback((action: UIAction) => {
    if (action.type === 'open_native_confirm') {
      const payload = (action.payload || {}) as Record<string, unknown>
      const confirmAction = payload.confirm_action as UIAction | undefined
      if (!confirmAction) {
        toast.showToast('error', 'Thiếu dữ liệu xác nhận để tiếp tục')
        return
      }

      setPendingConfirm({
        title: String(payload.title || 'Xác nhận thao tác'),
        message: String(payload.message || 'Bạn có chắc muốn tiếp tục thao tác này không?'),
        confirmLabel: String(payload.confirm_label || 'Xác nhận'),
        cancelLabel: String(payload.cancel_label || 'Hủy'),
        action: confirmAction,
      })
      return
    }

    const payload = (action.payload || {}) as Record<string, unknown>
    const displayMessage = typeof payload.display_message === 'string'
      ? payload.display_message
      : typeof (action as unknown as { display_message?: unknown }).display_message === 'string'
        ? (action as unknown as { display_message?: string }).display_message
        : undefined
    sendUiAction(action, displayMessage)
  }, [sendUiAction, toast])

  const handleWebSocketMessage = useCallback((data: {
    type: string
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
    stage?: 'IDLE' | 'COLLECTING' | 'PRESENTING' | 'CONFIRMING' | 'BOOKED'
  }) => {
    switch (data.type) {
      case 'history': {
        const newMessages = (data.messages || []).map(mapHistoryMessage)
        setMessages(prev => {
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
      case 'thinking_stream':
      case 'thinking':
        setSending(true)
        setLiveReasoning(data.content ?? 'Đang suy luận: mình đang phân tích yêu cầu của bạn.')
        break
      case 'tool_call':
        setSending(true)
        if (data.content?.trim()) setLiveReasoning(data.content)
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'action',
          content: data.content ?? `Calling ${data.tool_name}`,
          tool_name: data.tool_name,
          tool_params: data.tool_params,
          timestamp: new Date().toISOString(),
        }])
        break
      case 'tool_result':
        setSending(true)
        if (data.content?.trim()) setLiveReasoning(data.content)
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'observation',
          content: data.content ?? 'Tool result received',
          tool_name: data.tool_name,
          tool_result: data.result,
          timestamp: new Date().toISOString(),
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
                content: data.full_response ?? '',
                timestamp: new Date(),
                thinkingProcess,
                toolCalls,
              },
            ]
          }

          return [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.full_response ?? '',
            timestamp: new Date(),
            thinkingProcess,
            toolCalls,
          }]
        })
        break
      }
      case 'error':
        setSending(false)
        setStreamingContent('')
        setLiveReasoning('')
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.error ?? 'Đã có lỗi xảy ra',
          timestamp: new Date(),
        }])
        break
    }
  }, [mapHistoryMessage])

  const connectWebSocket = useCallback((sessionId: string) => {
    if (wsRef.current) return

    manualDisconnectRef.current = false
    const ws = createChatWebSocket(sessionId, sessionInfo?.contextType)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
      reconnectAttemptsRef.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (err) {
        console.error('WebSocket message parse error:', err)
      }
    }

    ws.onerror = () => {
      setConnectionStatus('error')
    }

    ws.onclose = () => {
      wsRef.current = null

      if (manualDisconnectRef.current || expectedSessionIdRef.current !== sessionId) {
        setConnectionStatus('disconnected')
        return
      }

      const nextAttempts = reconnectAttemptsRef.current + 1
      if (nextAttempts <= MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus('connecting')
        reconnectAttemptsRef.current = nextAttempts
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket(sessionId)
        }, RECONNECT_INTERVAL_MS)
      } else {
        setConnectionStatus('disconnected')
      }
    }
  }, [handleWebSocketMessage, sessionInfo?.contextType])

  useEffect(() => {
    expectedSessionIdRef.current = sessionInfo?.sessionId ?? null
  }, [sessionInfo?.sessionId])

  useEffect(() => {
    loadSessions()
    return () => disconnectWebSocket()
  }, [loadSessions, disconnectWebSocket])

  useEffect(() => {
    if (loadingSessions || creatingSession || sessionInfo) return
    if (autoBootstrapDoneRef.current) return

    autoBootstrapDoneRef.current = true

    if (sessionList.length > 0) {
      void handleSelectSession(sessionList[0].session_id)
      return
    }

    void createSession()
  }, [creatingSession, handleSelectSession, loadSessions, loadingSessions, sessionInfo, sessionList, createSession])

  useEffect(() => {
    if (sessionInfo?.sessionId && !wsRef.current) {
      setConnectionStatus('connecting')
      connectWebSocket(sessionInfo.sessionId)
    }
  }, [sessionInfo?.sessionId, connectWebSocket])

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages, streamingContent, liveReasoning])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || !sessionInfo?.sessionId || sending || connectionStatus !== 'connected') {
      if (input.trim() && sessionInfo?.sessionId && connectionStatus !== 'connected') {
        toast.showToast('error', 'Kết nối không sẵn sàng, đang thử lại...')
      }
      return
    }

    if (!wsRef.current || wsRef.current.readyState !== WEBSOCKET_OPEN_STATE) {
      toast.showToast('error', 'Kết nối không sẵn sàng, đang thử lại...')
      return
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSending(true)

    wsRef.current.send(JSON.stringify({ message: input.trim() }))
    setStreamingContent('')
  }, [connectionStatus, input, sessionInfo, sending, toast])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleFeedback = async (messageId: string, feedback: 'good' | 'bad') => {
    try {
      if (!sessionInfo?.sessionId) {
        toast.showToast('error', 'Không tìm thấy phiên chat để gửi phản hồi')
        return
      }

      await feedbackApi.submitFeedback({
        message_id: messageId,
        session_id: sessionInfo.sessionId,
        feedback_type: feedback === 'good' ? 'thumbs_up' : 'thumbs_down',
      })
      setMessages(prev => prev.map(msg => 
        msg.id === messageId ? { ...msg, feedback } : msg
      ))
      toast.showToast('success', 'Đã gửi phản hồi')
    } catch (err) {
      handleApiError(err, 'Không thể gửi phản hồi')
    }
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await chatApi.deleteSession(sessionId)
      setSessionList(prev => prev.filter(s => s.session_id !== sessionId))
      if (sessionInfo?.sessionId === sessionId) {
        disconnectWebSocket()
        setSessionInfo(null)
        setMessages([])
      }
      toast.showToast('success', 'Đã xóa cuộc chat')
    } catch (err) {
      handleApiError(err, 'Không thể xóa cuộc chat')
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-stone-100 safe-area-padding">
      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 border-r-2 border-stone-900 bg-white flex flex-col">
          <div className="p-4 border-b-2 border-stone-900">
            <div className="flex items-center gap-2 mb-3">
              <ComputerDesktopIcon className="w-6 h-6 text-amber-600" />
              <h2 className="text-base font-black text-stone-900 uppercase">AI Copilot</h2>
            </div>
            <p className="text-xs text-stone-500">Trợ lý thông minh cho quản lý phòng khám</p>
          </div>

          <div className="p-3 border-b-2 border-stone-900">
            <button
              onClick={createSession}
              disabled={creatingSession}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-stone-900 border-2 border-stone-900 font-black uppercase text-xs shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Chat mới
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingSessions ? (
              <div className="p-4 text-center text-xs text-stone-500">Đang tải...</div>
            ) : sessionList.length === 0 ? (
              <div className="p-4 text-center text-xs text-stone-500">Chưa có cuộc chat nào</div>
            ) : (
              <div className="divide-y divide-stone-200">
                {sessionList.map(session => (
                  <div
                    key={session.session_id}
                    onClick={() => handleSelectSession(session.session_id)}
                    className={`p-3 cursor-pointer hover:bg-stone-50 transition-colors ${
                      sessionInfo?.sessionId === session.session_id ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-stone-900 truncate">{session.title || 'Cuộc chat'}</p>
                        <p className="text-[10px] text-stone-500">
                          {session.created_at ? new Date(session.created_at).toLocaleDateString('vi-VN') : ''}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(session.session_id, e)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <TrashIcon className="w-4 h-4 text-stone-400 hover:text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t-2 border-stone-900 bg-stone-50">
            <button
              onClick={() => navigate('/clinic-owner')}
              className="w-full py-2 text-stone-600 hover:text-stone-900 text-xs font-bold uppercase"
            >
              Quay lại dashboard
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-stone-50">
          <div className="p-4 border-b-2 border-stone-900 bg-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-bold text-stone-900">
                {sessionInfo ? 'Copilot đang hoạt động' : 'Chưa kết nối'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`} />
              <span className="text-xs font-bold text-stone-500 uppercase">
                {connectionStatus === 'connected' ? 'Đã kết nối' :
                 connectionStatus === 'connecting' ? 'Đang kết nối' : 'Mất kết nối'}
              </span>
            </div>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {!sessionInfo ? (
              <div className="flex items-center justify-center h-full">
                <div className="p-6 bg-white border-4 border-stone-900 shadow-[6px_6px_0_#1c1917] max-w-sm text-center">
                  <div className="w-12 h-12 bg-amber-100 border-2 border-stone-900 flex items-center justify-center mx-auto mb-3">
                    <SparklesIcon className="w-6 h-6 text-amber-600" />
                  </div>
                  <h3 className="text-base font-black text-stone-900 mb-2 uppercase">AI Copilot</h3>
                  <p className="text-xs text-stone-600 mb-4">
                    {creatingSession || loadingSessions ? 'Đang chuẩn bị phiên làm việc cho AI Copilot...' : 'Đang kết nối phiên làm việc...'}
                  </p>
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
                    onUiAction={(action: UIAction) => handleUiAction(action)}
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
                          {streamingContent || liveReasoning || 'Đang suy luận...'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t-2 border-stone-900 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={sessionInfo?.sessionId ? 'Nhập yêu cầu cho AI Copilot...' : 'Chọn hoặc tạo chat trước'}
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
      </div>

      <ConfirmModal
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || 'Xác nhận thao tác'}
        message={pendingConfirm?.message || 'Bạn có chắc muốn tiếp tục?'}
        confirmLabel={pendingConfirm?.confirmLabel || 'Xác nhận'}
        cancelLabel={pendingConfirm?.cancelLabel || 'Hủy'}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (!pendingConfirm) return
          const action = pendingConfirm.action
          const payload = (action.payload || {}) as Record<string, unknown>
          const displayMessage = typeof payload.display_message === 'string'
            ? payload.display_message
            : typeof (action as unknown as { display_message?: unknown }).display_message === 'string'
              ? (action as unknown as { display_message?: string }).display_message
              : undefined
          setPendingConfirm(null)
          sendUiAction(action, displayMessage)
        }}
      />
    </div>
  )
}

export default ClinicOwnerAIChatPage
