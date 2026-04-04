import { useState, useEffect, useRef, useCallback } from 'react'
import { agentApi, chatApi, feedbackApi, type Agent, type ChatContextType, type ChatSessionMessage, type ChatSessionSummary } from '../../../services/agentService'
import { ChatMessage } from '../../../components/admin/ChatMessage'
import { ModelParametersConfig } from '../../../components/admin/ModelParametersConfig'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { env } from '../../../config/env'
import { useAuthStore } from '../../../store/authStore'
import { useToast } from '../../../components/Toast'
import { handleApiError } from '../../../utils/errorHandler'
import {
  ArrowPathIcon,
  ArrowRightIcon,
  TrashIcon,
  SignalIcon,
  SignalSlashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CpuChipIcon,
  WrenchScrewdriverIcon,
  EyeIcon,
  EyeSlashIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  XMarkIcon,
  KeyIcon,
  CommandLineIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline'
const AI_API_BASE_URL = env.AGENT_API_BASE_URL
const AI_WS_BASE_URL = env.AGENT_WS_BASE_URL
const getAuthHeaders = (): Record<string, string> => {
  const token = useAuthStore.getState().accessToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  images?: string[]
  timestamp: Date
  thinkingProcess?: string[]
  toolCalls?: Array<{ tool: string; input: unknown; output?: unknown }>
  feedback?: 'good' | 'bad' | null
  isStreaming?: boolean
}
interface ReActStep {
  step_index: number
  step_type: 'thought' | 'action' | 'observation'
  content: string
  tool_name?: string
  tool_params?: Record<string, unknown>
  tool_result?: unknown
  timestamp: string
}
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
type LLMProvider = 'openrouter'
interface DebugLog {
  id: string
  type: string
  data: unknown
  timestamp: string
}
interface SessionInfo {
  sessionId: string
  contextType: ChatContextType
  createdAt: string
  userRole: string
  clinicId?: string | null
}
// Available LLM providers
const PROVIDERS: Array<{ id: LLMProvider; name: string; description: string }> = [
  { id: 'openrouter', name: 'OpenRouter', description: 'Multi-model API (Gemini, Claude, Llama, GPT)' },
]
// Models per provider
const MODELS_BY_PROVIDER: Record<LLMProvider, Array<{ id: string; name: string; vision?: boolean }>> = {
  openrouter: [
    { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', vision: true },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', vision: true },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', vision: false },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', vision: false },
    { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', vision: true },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', vision: false },
  ],
}
/**
 * Agent Playground Page (Merged with Agent Settings)
 *
 * Features:
 * - WebSocket real-time chat with SingleAgent
 * - ReAct trace visualization (Thinking -> Tool Call -> Result -> Answer)
 * - Split view: Chat + ReAct Trace Panel
 * - Settings Panel: LLM config, API Key, Model Parameters
 */
export const PlaygroundPage = () => {
  const toast = useToast()
  // Agent selection
  const [agent, setAgent] = useState<Agent | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [loadingAgents, setLoadingAgents] = useState(true)
  // LLM Provider & Model selection
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('openrouter')
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.5-flash-lite')
  // Settings Panel State
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [providerKeys, setProviderKeys] = useState<Record<LLMProvider, string>>({
    openrouter: ''
  })
  const [savingProvider, setSavingProvider] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [creatingSession, setCreatingSession] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [sessionList, setSessionList] = useState<ChatSessionSummary[]>([])
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [allowedTools, setAllowedTools] = useState<string[]>([])
  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [seeding, setSeeding] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // ReAct trace state
  const [reactSteps, setReactSteps] = useState<ReActStep[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [showTracePanel, setShowTracePanel] = useState(true)
  const [debugPanelHeight, setDebugPanelHeight] = useState(40) // Default 40% height
  // Confirm modal state
  const [showSeedConfirm, setShowSeedConfirm] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<ChatSessionSummary | null>(null)
  // Image upload state for multimodal
  const [selectedImages, setSelectedImages] = useState<Array<{ file: File; preview: string; base64: string }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  // ==================== LOAD DATA ====================
  const loadProviderSettings = useCallback(async (currentProvider?: LLMProvider) => {
    try {
      const response = await fetch(`${AI_API_BASE_URL}/api/v1/settings`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to fetch settings')
      const data = await response.json()
      const settingsList = Array.isArray(data) ? data : (data.settings || [])
      const openrouterKey = settingsList.find((s: { key: string }) => s.key === 'OPENROUTER_API_KEY')?.value || ''
      const newKeys = { openrouter: openrouterKey }
      setProviderKeys(newKeys)
      const provider = currentProvider || selectedProvider
      setApiKey(newKeys[provider])
    } catch (err) {
      console.error('Failed to load provider settings:', err)
    }
  }, [selectedProvider])
  const loadAgentData = useCallback(async () => {
    try {
      setLoadingAgents(true)
      const response = await agentApi.getAgents()
      const enabledAgents = response.agents.filter(a => a.enabled)
      setAgents(enabledAgents)
      if (enabledAgents.length > 0) {
        const firstAgent = enabledAgents[0]
        setSelectedAgentId(firstAgent.id)
        // Load full agent details
        const agentData = await agentApi.getAgent(firstAgent.id)
        setAgent(agentData)
        setSelectedModel(agentData.model)
        setSelectedProvider('openrouter')
        // Load API keys
        await loadProviderSettings('openrouter')
      }
    } catch (err) {
      console.error('Failed to load agents:', err)
    } finally {
      setLoadingAgents(false)
    }
  }, [loadProviderSettings])
  // Load agents and settings on mount
  useEffect(() => {
    loadAgentData()
  }, [loadAgentData])
  const handleSeedDatabase = async () => {
    setShowSeedConfirm(false)
    try {
      setSeeding(true)
      const response = await fetch(`${AI_API_BASE_URL}/api/v1/settings/seed`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to seed database')
      await response.json()
      toast.showToast('success', 'Nhập dữ liệu từ database thành công!')
      await loadAgentData() // Reload agents
    } catch (err) {
      handleApiError(err, toast, 'Nhập dữ liệu thất bại')
    } finally {
      setSeeding(false)
    }
  }
  // ==================== PROVIDER HANDLERS ====================
  const handleProviderChange = (provider: LLMProvider) => {
    setSelectedProvider(provider)
    setApiKey(providerKeys[provider])
    const models = MODELS_BY_PROVIDER[provider]
    if (models.length > 0) {
      setSelectedModel(models[0].id)
    }
  }
  const handleTestConnection = async () => {
    if (!apiKey) {
      toast.showToast('warning', 'Vui lòng nhập API Key')
      return
    }
    try {
      setTestingConnection(true)
      const endpoint = '/api/v1/settings/test-openrouter'
      const response = await fetch(`${AI_API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ api_key: apiKey }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || 'Connection test failed')
      }
      toast.showToast('success', 'Kết nối thành công!')
    } catch (err) {
      handleApiError(err, toast, 'Kết nối thất bại')
    } finally {
      setTestingConnection(false)
    }
  }
  const handleSaveProvider = async () => {
    if (!apiKey) {
      toast.showToast('warning', 'Vui lòng nhập API Key')
      return
    }
    try {
      setSavingProvider(true)
      const isMasked = apiKey.startsWith('****')
      if (!isMasked) {
        const apiKeyKey = 'OPENROUTER_API_KEY'
        const keyResponse = await fetch(`${AI_API_BASE_URL}/api/v1/settings/${apiKeyKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({ value: apiKey }),
        })
        if (!keyResponse.ok) throw new Error('Failed to save API Key')
        setProviderKeys(prev => ({ ...prev, [selectedProvider]: apiKey }))
      }
      if (agent) {
        await agentApi.updateAgent(agent.id, { model: selectedModel })
        setAgent({ ...agent, model: selectedModel })
      }
      toast.showToast('success', 'Đã lưu cấu hình')
    } catch (err) {
      handleApiError(err, toast, 'Không thể lưu cấu hình')
    } finally {
      setSavingProvider(false)
    }
  }
  // ==================== PARAMETERS HANDLERS ====================
  const handleUpdateParameters = async (params: { temperature?: number; max_tokens?: number; top_p?: number }) => {
    if (!agent) return
    try {
      await agentApi.updateAgent(agent.id, params)
      const updated = await agentApi.getAgent(agent.id)
      setAgent(updated)
      toast.showToast('success', 'Đã cập nhật parameters')
    } catch (err) {
      handleApiError(err, toast, 'Không thể cập nhật')
    }
  }
  const handleToggleEnabled = async () => {
    if (!agent) return
    try {
      const newEnabled = !agent.enabled
      await agentApi.updateAgent(agent.id, { enabled: newEnabled })
      setAgent({ ...agent, enabled: newEnabled })
      toast.showToast('success', `Agent đã được ${newEnabled ? 'bật' : 'tắt'}`)
    } catch (err) {
      handleApiError(err, toast, 'Không thể thay đổi trạng thái')
    }
  }
  const mapHistoryMessage = useCallback((message: ChatSessionMessage): Message => {
    const reactTrace = message.react_trace || []
    const thinkingProcess = reactTrace
      .filter(step => step.step_type === 'thought' && step.content)
      .map(step => step.content as string)
    const toolCalls: Array<{ tool: string; input: unknown; output?: unknown }> = []
    for (const step of reactTrace) {
      if (step.step_type === 'action' && step.tool_name) {
        toolCalls.push({
          tool: step.tool_name,
          input: step.tool_params || {},
          output: undefined,
        })
      }
      if (step.step_type === 'observation' && toolCalls.length > 0) {
        toolCalls[toolCalls.length - 1].output = step.tool_result
      }
    }
    const images = message.metadata?.images as string[] | undefined
    return {
      id: message.message_id || crypto.randomUUID(),
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
      images: images?.length ? images : undefined,
      timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
      thinkingProcess: thinkingProcess.length > 0 ? thinkingProcess : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    }
  }, [])
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setConnectionStatus('disconnected')
  }, [])
  const loadPlaygroundSessions = useCallback(async () => {
    try {
      setLoadingSessions(true)
      const response = await chatApi.listSessions('PLAYGROUND_TEST', 20)
      setSessionList(response.sessions)
    } catch (err) {
      console.error('Failed to load playground sessions:', err)
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
      setAllowedTools([])
      const session = await chatApi.getSession(sessionId)
      setSessionInfo({
        sessionId: session.session_id,
        contextType: session.context_type,
        createdAt: session.created_at || new Date().toISOString(),
        userRole: session.user_role || 'ADMIN',
        clinicId: session.clinic_id,
      })
      setMessages(session.messages.map(mapHistoryMessage))
    } catch (err) {
      handleApiError(err, toast, 'Không thể mở cuộc chat đã chọn')
    }
  }, [disconnectWebSocket, mapHistoryMessage, toast])
  const handleDeleteSession = useCallback(async () => {
    if (!sessionToDelete) return
    try {
      setDeletingSessionId(sessionToDelete.session_id)
      await chatApi.deleteSession(sessionToDelete.session_id)
      if (sessionInfo?.sessionId === sessionToDelete.session_id) {
        disconnectWebSocket()
        setSessionInfo(null)
        setMessages([])
        setReactSteps([])
        setStreamingContent('')
        setAllowedTools([])
        setSending(false)
      }
      setSessionList(prev => prev.filter(session => session.session_id !== sessionToDelete.session_id))
      toast.showToast('success', 'Đã xóa session chat')
      setSessionToDelete(null)
      await loadPlaygroundSessions()
    } catch (err) {
      handleApiError(err, toast, 'Không thể xóa session chat')
    } finally {
      setDeletingSessionId(null)
    }
  }, [disconnectWebSocket, loadPlaygroundSessions, sessionInfo?.sessionId, sessionToDelete, toast])
  useEffect(() => {
    void loadPlaygroundSessions()
  }, [loadPlaygroundSessions])
  const createPlaygroundSession = useCallback(async () => {
    if (creatingSession) return
    try {
      setCreatingSession(true)
      disconnectWebSocket()
      setConnectionStatus('connecting')
      const session = await chatApi.createSession({
        agent_id: selectedAgentId ?? undefined,
        title: `Playground ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
        context_type: 'PLAYGROUND_TEST',
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
      setAllowedTools([])
      await loadPlaygroundSessions()
    } catch (err) {
      setConnectionStatus('error')
      handleApiError(err, toast, 'Không thể tạo playground session')
    } finally {
      setCreatingSession(false)
    }
  }, [creatingSession, disconnectWebSocket, loadPlaygroundSessions, selectedAgentId, toast])
  // ==================== WEBSOCKET ====================
  const connectWebSocket = useCallback(() => {
    if (!sessionInfo?.sessionId) return
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return
    setConnectionStatus('connecting')
    const token = useAuthStore.getState().accessToken
    const fullWsUrl = `${AI_WS_BASE_URL}/ws/chat/${sessionInfo.sessionId}?token=${token}&context_type=${sessionInfo.contextType}`
    const ws = new WebSocket(fullWsUrl)
    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnectionStatus('connected')
    }
    ws.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason)
      setConnectionStatus('disconnected')
      if (wsRef.current === ws) {
        wsRef.current = null
      }
    }
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('error')
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Add to debug logs
        const logEntry: DebugLog = {
          id: crypto.randomUUID(),
          type: typeof (data as { type?: string })?.type === 'string' ? (data as { type: string }).type : 'unknown',
          data: data,
          timestamp: new Date().toISOString()
        }
        setDebugLogs(prev => [logEntry, ...prev].slice(0, 100))
        handleWebSocketMessage(data)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }
    wsRef.current = ws
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionInfo?.contextType, sessionInfo?.sessionId])
  const handleWebSocketMessage = useCallback((data: {
    type: string
    session_id?: string
    context_type?: ChatContextType
    messages?: ChatSessionMessage[]
    user?: string
    agent_name?: string
    allowed_tools?: string[]
    content?: string
    step_index?: number
    tool_name?: string
    tool_params?: Record<string, unknown>
    result?: unknown
    full_response?: string
    react_trace?: ReActStep[]
    error?: string
  }) => {
    switch (data.type) {
      case 'connected':
        console.log('WebSocket session established')
        if (data.session_id && data.context_type) {
          const nextSessionId = data.session_id
          const nextContextType = data.context_type
          setSessionInfo(prev => {
            if (!prev) return prev
            if (prev.sessionId === nextSessionId && prev.contextType === nextContextType) {
              return prev
            }
            return {
              ...prev,
              sessionId: nextSessionId,
              contextType: nextContextType,
            }
          })
        }
        break
      case 'history':
        setMessages((data.messages || []).map(mapHistoryMessage))
        setStreamingContent('')
        setSending(false)
        break
      case 'ack':
        setStreamingContent('')
        setReactSteps([])
        break
      case 'agent_info':
        setAllowedTools(data.allowed_tools || [])
        break
      case 'thinking':
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'thought',
          content: data.content ?? '',
          tool_name: data.tool_name,
          tool_params: data.tool_params,
          timestamp: new Date().toISOString()
        }])
        setExpandedSteps(prev => new Set([...prev, data.step_index ?? 0]))
        break
      case 'tool_call':
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'action',
          content: data.content ?? `Calling ${data.tool_name}`,
          tool_name: data.tool_name,
          tool_params: data.tool_params,
          timestamp: new Date().toISOString()
        }])
        setExpandedSteps(prev => new Set([...prev, data.step_index ?? 0]))
        break
      case 'tool_result':
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'observation',
          content: data.content ?? 'Tool result received',
          tool_name: data.tool_name,
          tool_result: data.result,
          timestamp: new Date().toISOString()
        }])
        setExpandedSteps(prev => new Set([...prev, data.step_index ?? 0]))
        break
      case 'stream':
        setStreamingContent(prev => prev + (data.content ?? ''))
        break
      case 'complete': {
        setSending(false)
        setStreamingContent('')
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
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.full_response ?? '',
          timestamp: new Date(),
          thinkingProcess,
          toolCalls
        }])
        void loadPlaygroundSessions()
        break
      }
      case 'error':
        setSending(false)
        setStreamingContent('')
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `[Error] ${data.error ?? 'Unknown error'}`,
          timestamp: new Date()
        }])
        break
    }
  }, [loadPlaygroundSessions, mapHistoryMessage])
  useEffect(() => {
    if (!sessionInfo?.sessionId) {
      disconnectWebSocket()
      return
    }
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connectWebSocket, disconnectWebSocket, sessionInfo?.sessionId])
  useEffect(() => {
    if (scrollContainerRef.current) {
      const { scrollHeight, clientHeight } = scrollContainerRef.current
      scrollContainerRef.current.scrollTo({
        top: scrollHeight - clientHeight,
        behavior: messages.length > 0 && messages[messages.length - 1].role === 'user' ? 'auto' : 'smooth'
      })
    }
  }, [messages, streamingContent])
  // ==================== CHAT HANDLERS ====================
  const sendMessage = async () => {
    if (!input.trim() || sending || connectionStatus !== 'connected' || !sessionInfo?.sessionId) return
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      images: selectedImages.length > 0 ? selectedImages.map(img => img.base64) : undefined,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSending(true)
    setReactSteps([])
    // Build WebSocket message with optional images
    const wsPayload: Record<string, unknown> = {
      message: userMessage.content,
      agent_id: selectedAgentId,
      provider: selectedProvider,
      model: selectedModel
    }
    // Add images if any (base64 encoded)
    if (selectedImages.length > 0) {
      wsPayload.images = selectedImages.map(img => img.base64)
    }
    wsRef.current?.send(JSON.stringify(wsPayload))
    // Clear selected images after sending
    setSelectedImages([])
  }
  const handleFeedback = async (messageId: string, feedback: 'good' | 'bad') => {
    // Cập nhật UI ngay lập tức
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback } : msg
    ))
    // Gọi API lưu feedback vào MongoDB
    if (sessionInfo?.sessionId) {
      try {
        await feedbackApi.submitFeedback({
          message_id: messageId,
          session_id: sessionInfo.sessionId,
          feedback_type: feedback === 'good' ? 'thumbs_up' : 'thumbs_down',
        })
      } catch (err) {
        console.error('Failed to save playground feedback:', err)
      }
    }
  }
  const clearChat = () => {
    setMessages([])
    setReactSteps([])
    setStreamingContent('')
    setSelectedImages([])
  }
  // Image handling
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const MAX_IMAGES = 4
    const MAX_SIZE_MB = 5
    const newImages: Array<{ file: File; preview: string; base64: string }> = []
    for (let i = 0; i < Math.min(files.length, MAX_IMAGES - selectedImages.length); i++) {
      const file = files[i]
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.showToast('error', `ảnh ${file.name} quá lớn (tối đa ${MAX_SIZE_MB}MB)`)
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
        base64: base64.split(',')[1], // Remove data:image/xxx;base64, prefix
      })
    }
    if (newImages.length > 0) {
      setSelectedImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES))
    }
    // Reset input
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
  const toggleStepExpand = (stepIndex: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepIndex)) next.delete(stepIndex)
      else next.add(stepIndex)
      return next
    })
  }
  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'thought': return <CpuChipIcon className="w-4 h-4" />
      case 'action': return <WrenchScrewdriverIcon className="w-4 h-4" />
      case 'observation': return <EyeIcon className="w-4 h-4" />
      default: return <ChatBubbleLeftRightIcon className="w-4 h-4" />
    }
  }
  const getStepColor = (stepType: string) => {
    switch (stepType) {
      case 'thought': return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'action': return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'observation': return 'bg-green-100 text-green-700 border-green-300'
      default: return 'bg-stone-100 text-stone-700 border-stone-300'
    }
  }
  // ==================== RENDER ====================
  if (loadingAgents) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-stone-600 font-bold uppercase text-sm">Đang tải...</p>
        </div>
      </div>
    )
  }
  return (
    <div className="h-full bg-stone-50 flex flex-col overflow-hidden">
      {/* Page Header */}
      <div className="bg-white border-b-2 border-stone-900 shrink-0">
        <div className="w-full mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <h1 className="text-xl font-black text-stone-900 uppercase tracking-tight">Agent Playground</h1>
                <p className="text-[10px] text-stone-600 font-bold uppercase tracking-wide">AI Agent Trace Real-time</p>
              </div>
              {/* Status Badge in Header */}
              <div className={`flex items-center gap-1.5 px-2 py-1 border-2 border-stone-900 transition-colors shadow-[1px_1px_0_#1c1917] ${connectionStatus === 'connected' ? 'bg-green-100' :
                connectionStatus === 'connecting' ? 'bg-yellow-100' :
                  connectionStatus === 'error' ? 'bg-red-100' : 'bg-stone-50'
                }`}>
                {connectionStatus === 'connected' ? (
                  <SignalIcon className="w-3 h-3 text-green-700" />
                ) : (
                  <SignalSlashIcon className="w-3 h-3 text-stone-400" />
                )}
                <span className="text-[9px] font-black uppercase text-stone-900 tracking-tighter">
                  {connectionStatus}
                </span>
              </div>
            </div>
            {/* Header Actions */}
            <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
              <button
                onClick={() => void createPlaygroundSession()}
                disabled={creatingSession}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] bg-blue-200 text-stone-900 hover:bg-blue-300 disabled:bg-stone-300 disabled:cursor-not-allowed"
              >
                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                {creatingSession ? 'Đang tạo' : 'Chat mới'}
              </button>
              <button
                onClick={() => void loadPlaygroundSessions()}
                disabled={loadingSessions}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] bg-white text-stone-900 hover:bg-stone-50 disabled:bg-stone-300 disabled:cursor-not-allowed"
              >
                <ArrowPathIcon className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />
                Làm mới
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] ${showSettings ? 'bg-amber-400 text-stone-900' : 'bg-white text-stone-900 hover:bg-stone-50'}`}
              >
                <Cog6ToothIcon className="w-3.5 h-3.5" />
                Settings
              </button>
              <button
                onClick={() => setShowTracePanel(!showTracePanel)}
                className={`flex-1 md:flex-none px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] ${showTracePanel ? 'bg-amber-400 text-stone-900' : 'bg-white text-stone-900 hover:bg-stone-50'}`}
              >
                {showTracePanel ? 'Hide Trace' : 'Show Trace'}
              </button>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] border-2 border-stone-900 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] ${showDebug ? 'bg-purple-400 text-stone-900' : 'bg-white text-stone-900 hover:bg-stone-50'}`}
              >
                <CommandLineIcon className="w-3.5 h-3.5" />
                Logs
              </button>
              <button
                onClick={clearChat}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 font-black uppercase text-[10px] text-stone-900 bg-white border-2 border-stone-900 hover:bg-stone-50 transition-all cursor-pointer shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
              >
                <TrashIcon className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Agent Controls & Info Bar */}
      <div className="px-4 py-2 bg-stone-100 border-b-2 border-stone-900 flex flex-wrap items-center gap-4 shrink-0">
        {/* Selectors Group */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase text-stone-500">Agent</span>
            <select
              value={selectedAgentId ?? ''}
              onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              disabled={loadingAgents}
              title="Chọn agent"
              aria-label="Chọn agent"
              className="px-2 py-1 border-2 border-stone-900 bg-white font-black text-[10px] focus:ring-0 outline-none cursor-pointer text-stone-900 min-w-[120px]"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase text-stone-500">Provider</span>
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
              title="Chọn nhà cung cấp mô hình"
              aria-label="Chọn nhà cung cấp mô hình"
              className="px-2 py-1 border-2 border-stone-900 bg-white font-black text-[10px] focus:ring-0 outline-none cursor-pointer text-stone-900 min-w-[100px]"
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase text-stone-500">Model</span>
            <div className="flex items-center gap-2">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                title="Chọn mô hình AI"
                aria-label="Chọn mô hình AI"
                className="px-2 py-1 border-2 border-stone-900 bg-white font-black text-[10px] focus:ring-0 outline-none cursor-pointer text-stone-900 min-w-[160px]"
              >
                {MODELS_BY_PROVIDER[selectedProvider].map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {MODELS_BY_PROVIDER[selectedProvider].find(m => m.id === selectedModel)?.vision && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 border border-purple-300 text-[9px] font-black uppercase rounded">
                  Vision
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Vertical Divider */}
        <div className="h-10 w-0.5 bg-stone-300 hidden md:block"></div>
        {/* Status Group */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase text-stone-500 tracking-wider text-center">Status</span>
            <span className={`px-3 py-1 border-2 border-stone-900 font-black text-[10px] shadow-[1px_1px_0_#1c1917] ${agent?.enabled ? 'bg-green-400 text-stone-900' : 'bg-stone-300 text-stone-600'}`}>
              {agent?.enabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase text-stone-500 tracking-wider text-center">Context</span>
            <span className="px-3 py-1 border-2 border-stone-900 font-black text-[10px] bg-purple-200 text-stone-900 shadow-[1px_1px_0_#1c1917]">
              {sessionInfo?.contextType || 'PLAYGROUND_TEST'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5 min-w-[180px]">
            <span className="text-[9px] font-black uppercase text-stone-500 tracking-wider">Session ID</span>
            <span className="px-2 py-1 border-2 border-stone-900 font-black text-[10px] bg-white text-stone-700 shadow-[1px_1px_0_#1c1917] truncate">
              {sessionInfo?.sessionId || (creatingSession ? 'ĐANG TẠO...' : 'CHƯA CÓ SESSION')}
            </span>
          </div>
        </div>
      </div>
      <div className="px-4 py-2 bg-white border-b-2 border-stone-900 flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-[10px] font-black uppercase text-stone-500">Phiên chat</span>
        {loadingSessions ? (
          <span className="text-[10px] font-bold text-stone-500">Đang tải danh sách session...</span>
        ) : sessionList.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {sessionList.map(session => {
              const isActive = session.session_id === sessionInfo?.sessionId
              const isDeleting = deletingSessionId === session.session_id
              return (
                <div
                  key={session.session_id}
                  className={`flex items-center gap-1 border-2 border-stone-900 shadow-[1px_1px_0_#1c1917] ${isActive ? 'bg-amber-300 text-stone-900' : 'bg-white text-stone-700'}`}
                >
                  <button
                    onClick={() => void handleSelectSession(session.session_id)}
                    className={`px-2 py-1 text-[10px] font-black transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${isActive ? 'text-stone-900' : 'text-stone-700 hover:bg-stone-50'}`}
                    title={session.title || session.session_id}
                  >
                    <span className="uppercase">{session.title || 'Playground chat'}</span>
                    <span className="ml-2 text-stone-500 normal-case">
                      {session.updated_at ? new Date(session.updated_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa có thời gian'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionToDelete(session)}
                    title="Xóa session"
                    aria-label="Xóa session"
                    disabled={isDeleting}
                    className="px-2 py-1 border-l-2 border-stone-900 text-red-700 hover:bg-red-100 disabled:text-stone-400 disabled:cursor-not-allowed"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <span className="text-[10px] font-bold text-stone-500">Chưa có session nào. Hãy bấm Chat mới để bắt đầu.</span>
        )}
      </div>
      <div className="px-4 py-2 bg-white border-b-2 border-stone-900 flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-[10px] font-black uppercase text-stone-500">Allowed tools</span>
        {allowedTools.length > 0 ? (
          allowedTools.map(tool => (
            <span
              key={tool}
              className="px-2 py-1 text-[10px] font-black uppercase bg-blue-100 text-stone-900 border-2 border-stone-900 shadow-[1px_1px_0_#1c1917]"
            >
              {tool}
            </span>
          ))
        ) : (
          <span className="text-[10px] font-bold text-stone-500">
            {connectionStatus === 'connected' ? 'Chưa nhận metadata tool' : 'Đang chờ kết nối session'}
          </span>
        )}
      </div>
      {connectionStatus === 'error' && (
        <div className="px-4 py-2 bg-red-100 border-b-2 border-stone-900 text-xs text-red-800 font-bold">
          Không thể kết nối tới AI Service. Vui lòng kiểm tra lại cấu hình AI REST/WS URL trong môi trường và tải lại trang.
        </div>
      )}
      {/* Main Content - Split View */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-6 bg-stone-50"
          >
            {messages.length === 0 && !streamingContent ? (
              <div className="flex items-center justify-center h-full text-center">
                <div className="p-8 bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-md">
                  <div className="w-16 h-16 bg-amber-100 border-4 border-stone-900 flex items-center justify-center mx-auto mb-4">
                    <ChatBubbleLeftRightIcon className="w-8 h-8 text-stone-700" />
                  </div>
                  <h3 className="text-lg font-black text-stone-900 mb-2 uppercase">
                    {agents.length === 0 ? 'Hệ thống chưa sẵn sàng' : sessionInfo?.sessionId ? 'Sẵn sàng trò chuyện' : 'Chọn hoặc tạo chat'}
                  </h3>
                  <p className="text-sm text-stone-600 mb-6">
                    {agents.length === 0
                      ? 'Database của AI Service hiện đang trống. Vui lòng nạp dữ liệu mẫu để bắt đầu.'
                      : sessionInfo?.sessionId
                        ? 'Gửi tin nhắn để xem ReAct trace theo thời gian thực.'
                        : 'Admin có thể mở lại session cũ hoặc bấm Chat mới để tạo một phiên playground mới.'}
                  </p>
                  {agents.length === 0 && (
                    <button
                      onClick={() => setShowSeedConfirm(true)}
                      disabled={seeding}
                      className="w-full py-3 bg-amber-400 text-stone-900 border-2 border-stone-900 font-black uppercase text-sm shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {seeding ? 'Đang khởi tạo...' : 'Khởi tạo dữ liệu AI (Seed)'}
                    </button>
                  )}
                  {agents.length > 0 && !sessionInfo?.sessionId && (
                    <button
                      onClick={() => void createPlaygroundSession()}
                      disabled={creatingSession}
                      className="w-full py-3 bg-blue-300 text-stone-900 border-2 border-stone-900 font-black uppercase text-sm shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingSession ? 'Đang tạo chat...' : 'Tạo chat mới'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map(msg => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    images={msg.images}
                    timestamp={msg.timestamp}
                    thinkingProcess={msg.thinkingProcess}
                    toolCalls={msg.toolCalls?.map(t => ({ ...t, input: (t.input ?? {}) as Record<string, unknown> }))}
                    feedback={msg.feedback}
                    onFeedback={(feedback) => handleFeedback(msg.id, feedback)}
                  />
                ))}
                {(sending || streamingContent) && (
                  <div className="flex gap-3 flex-row mb-6">
                    <div className="flex-shrink-0 w-9 h-9 border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] flex items-center justify-center bg-amber-400">
                      <ArrowPathIcon className="w-5 h-5 text-stone-900 animate-spin" />
                    </div>
                    <div className="flex flex-col items-start max-w-[85%]">
                      <div className="flex items-center gap-3 mb-2 px-1">
                        <span className="text-[10px] font-black uppercase text-stone-500 tracking-widest">
                          Petties Assistant
                        </span>
                      </div>
                      <div className="relative border-2 border-stone-900 p-3.5 w-fit bg-white text-stone-900 shadow-[3px_3px_0_#1c1917] animate-pulse">
                        <div className="text-sm md:text-base font-bold whitespace-pre-wrap leading-relaxed">
                          {streamingContent || 'Thinking...'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Input Area */}
          <div className="p-4 border-t-4 border-stone-900 bg-white">
            {/* Image Preview */}
            {selectedImages.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap items-center">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={img.preview}
                      alt={`Preview ${idx + 1}`}
                      className="w-16 h-16 object-cover border-2 border-stone-900 rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white border-2 border-stone-900 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {!MODELS_BY_PROVIDER[selectedProvider].find(m => m.id === selectedModel)?.vision && (
                  <span className="px-2 py-1 bg-red-100 border border-red-300 text-red-700 text-xs font-bold uppercase rounded">
                    Model không hỗ trợ ảnh! Chọn Gemini hoặc Claude
                  </span>
                )}
              </div>
            )}
            <div className="flex gap-3">
              {/* Image Attachment Button */}
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
                disabled={sending || connectionStatus !== 'connected' || !sessionInfo?.sessionId || selectedImages.length >= 4}
                title="Đính kèm ảnh"
                aria-label="Đính kèm ảnh"
                className="px-3 py-3 font-black text-stone-900 bg-stone-100 border-4 border-stone-900 hover:bg-stone-200 disabled:bg-stone-50 disabled:cursor-not-allowed transition-colors cursor-pointer self-end shadow-[4px_4px_0_#1c1917] hover:shadow-[2px_2px_0_#1c1917] hover:translate-x-[2px] hover:translate-y-[2px] disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
              >
                <PhotoIcon className="w-5 h-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={sessionInfo?.sessionId ? 'Nhập tin nhắn... (Enter để gửi)' : 'Hãy chọn session cũ hoặc tạo chat mới trước khi gửi tin nhắn'}
                rows={3}
                disabled={sending || connectionStatus !== 'connected' || !sessionInfo?.sessionId}
                className="flex-1 px-4 py-3 border-4 border-stone-900 focus:ring-0 outline-none text-sm resize-none disabled:bg-stone-100 disabled:cursor-not-allowed text-stone-900 bg-white font-medium"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim() || connectionStatus !== 'connected' || !sessionInfo?.sessionId}
                title="Gửi tin nhắn"
                aria-label="Gửi tin nhắn"
                className="px-6 py-3 font-black text-white bg-amber-500 border-4 border-stone-900 hover:bg-amber-600 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer self-end shadow-[4px_4px_0_#1c1917] hover:shadow-[2px_2px_0_#1c1917] hover:translate-x-[2px] hover:translate-y-[2px] disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
              >
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
        {/* ReAct Trace Panel */}
        {showTracePanel && (
          <div className="w-full md:w-80 lg:w-96 flex flex-col bg-white border-t-4 md:border-t-0 md:border-l-4 border-stone-900 h-1/3 md:h-auto flex-none">
            <div className="px-4 py-3 bg-stone-900 text-white">
              <h2 className="font-black uppercase text-sm">ReAct Trace</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Thought → Action → Observation
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {reactSteps.length === 0 ? (
                <div className="text-center py-8 text-stone-400">
                  <CpuChipIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No trace yet</p>
                  <p className="text-xs">Send a message to see agent thinking</p>
                </div>
              ) : (
                reactSteps.map((step, idx) => (
                  <div key={idx} className={`border-2 border-stone-900 ${getStepColor(step.step_type)}`}>
                    <button
                      onClick={() => toggleStepExpand(step.step_index)}
                      className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-opacity-80 transition-colors"
                    >
                      {expandedSteps.has(step.step_index) ? (
                        <ChevronDownIcon className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />
                      )}
                      {getStepIcon(step.step_type)}
                      <span className="font-bold text-xs uppercase flex-1">
                        [{step.step_index}] {step.step_type}
                      </span>
                      {step.tool_name && (
                        <span className="px-1.5 py-0.5 bg-white border border-current text-xs font-mono">
                          {step.tool_name}
                        </span>
                      )}
                    </button>
                    {expandedSteps.has(step.step_index) && (
                      <div className="px-3 pb-3 pt-1 border-t border-current border-opacity-30">
                        <p className="text-xs whitespace-pre-wrap break-words">{step.content}</p>
                        {step.tool_params && Object.keys(step.tool_params).length > 0 && (
                          <div className="mt-2 p-2 bg-white border border-current rounded text-xs">
                            <span className="font-bold">Params:</span>
                            <pre className="mt-1 overflow-x-auto text-[10px]">
                              {JSON.stringify(step.tool_params, null, 2)}
                            </pre>
                          </div>
                        )}
                        {step.tool_result !== undefined && (
                          <div className="mt-2 p-2 bg-white border border-current rounded text-xs">
                            <span className="font-bold">Result:</span>
                            <pre className="mt-1 overflow-x-auto overflow-y-auto text-[10px] max-h-48 whitespace-pre-wrap break-words">
                              {typeof step.tool_result === 'string'
                                ? step.tool_result.slice(0, 2000)
                                : JSON.stringify(step.tool_result, null, 2).slice(0, 2000)}
                              {(typeof step.tool_result === 'string' ? step.tool_result.length : JSON.stringify(step.tool_result).length) > 2000 && '\n... [Xem thêm trong Debug Console]'}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {reactSteps.length > 0 && (
              <div className="px-4 py-2 bg-stone-100 border-t-2 border-stone-900 text-xs">
                <span className="font-bold">Total Steps:</span> {reactSteps.length} |{' '}
                <span className="text-blue-600">{reactSteps.filter(s => s.step_type === 'thought').length} thoughts</span> |{' '}
                <span className="text-purple-600">{reactSteps.filter(s => s.step_type === 'action').length} actions</span> |{' '}
                <span className="text-green-600">{reactSteps.filter(s => s.step_type === 'observation').length} observations</span>
              </div>
            )}
          </div>
        )}
        {/* Debug Console (Overlay) - Resizable */}
        {showDebug && (
          <div
            className="absolute inset-x-0 bottom-0 z-40 bg-stone-900 border-t-4 border-stone-900 flex flex-col shadow-[0_-10px_50px_rgba(0,0,0,0.5)]"
            style={{ height: `${debugPanelHeight}%` }}
          >
            {/* Resize Handle */}
            <div
              className="h-2 bg-stone-700 cursor-ns-resize hover:bg-purple-500 transition-colors flex items-center justify-center group"
              onMouseDown={(e) => {
                e.preventDefault()
                const startY = e.clientY
                const startHeight = debugPanelHeight
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaY = startY - moveEvent.clientY
                  const containerHeight = window.innerHeight
                  const deltaPercent = (deltaY / containerHeight) * 100
                  const newHeight = Math.max(20, Math.min(80, startHeight + deltaPercent))
                  setDebugPanelHeight(newHeight)
                }
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove)
                  document.removeEventListener('mouseup', handleMouseUp)
                }
                document.addEventListener('mousemove', handleMouseMove)
                document.addEventListener('mouseup', handleMouseUp)
              }}
            >
              <div className="w-12 h-1 bg-stone-500 rounded-full group-hover:bg-white transition-colors" />
            </div>
            <div className="flex items-center justify-between px-4 py-2 bg-stone-800 border-b-2 border-stone-700">
              <div className="flex items-center gap-2">
                <CommandLineIcon className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-black uppercase text-stone-300 tracking-widest">ReAct Real-time Event Log</span>
                <span className="text-[10px] text-stone-500">(Kéo cạnh trên để thay đổi kích thước)</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setDebugLogs([])} className="text-[10px] font-black uppercase text-stone-500 hover:text-white">Clear</button>
                <button onClick={() => setShowDebug(false)} title="Đóng bảng log" aria-label="Đóng bảng log" className="text-stone-400 hover:text-white">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-2">
              {debugLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-stone-600 italic">No events yet... Waiting for agent interaction.</div>
              ) : (
                debugLogs.map((log) => (
                  <div key={log.id} className="border-l-2 border-stone-700 pl-3 py-1 hover:bg-stone-800 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-stone-500">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                      <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[9px] ${log.type === 'thinking' ? 'bg-blue-900 text-blue-200' :
                        log.type === 'tool_call' ? 'bg-purple-900 text-purple-200' :
                          log.type === 'tool_result' ? 'bg-green-900 text-green-200' :
                            log.type === 'error' ? 'bg-red-900 text-red-200' :
                              'bg-stone-700 text-stone-300'
                        }`}>
                        {log.type}
                      </span>
                    </div>
                    <pre className="text-stone-300 whitespace-pre-wrap break-all">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {/* Settings Panel (Overlay) */}
        {showSettings && (
          <div className="absolute inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/30" onClick={() => setShowSettings(false)} />
            {/* Settings Drawer */}
            <div className="w-full max-w-lg bg-white border-l-4 border-stone-900 overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-4 bg-amber-400 border-b-4 border-stone-900 flex items-center justify-between sticky top-0">
                <div className="flex items-center gap-3">
                  <Cog6ToothIcon className="w-6 h-6 text-stone-900" />
                  <h2 className="text-xl font-black uppercase text-stone-900">Agent Settings</h2>
                </div>
                <button onClick={() => setShowSettings(false)} title="Đóng cài đặt" aria-label="Đóng cài đặt" className="p-1 hover:bg-amber-500 rounded">
                  <XMarkIcon className="w-6 h-6 text-stone-900" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {/* Agent Status */}
                {agent && (
                  <div className="flex items-center justify-between p-4 bg-stone-100 border-2 border-stone-900">
                    <div>
                      <p className="font-black uppercase text-sm text-stone-900">Agent Status</p>
                      <p className="text-xs text-stone-600">{agent.name}</p>
                    </div>
                    <button
                      onClick={handleToggleEnabled}
                      className={`px-4 py-2 font-bold uppercase text-xs border-2 border-stone-900 transition-colors ${agent.enabled ? 'bg-green-400' : 'bg-stone-300'}`}
                    >
                      {agent.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                )}
                {/* Provider Config */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase text-stone-900">
                    <CpuChipIcon className="w-5 h-5" />
                    LLM Provider
                  </div>
                  <div className="flex gap-2">
                    {PROVIDERS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => handleProviderChange(p.id)}
                        className={`flex-1 px-4 py-3 font-bold uppercase text-sm border-2 border-stone-900 transition-all ${selectedProvider === p.id ? 'bg-amber-400 text-stone-900' : 'bg-white text-stone-900 hover:bg-stone-100'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  {/* API Key */}
                  <div>
                    <label className="block text-sm font-black uppercase text-stone-900 mb-2">
                      <KeyIcon className="w-4 h-4 inline mr-1" />
                      API Key
                    </label>
                    <div className="flex gap-2">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter API key..."
                        className="flex-1 px-4 py-2 border-2 border-stone-900 bg-white text-stone-900 font-mono text-sm"
                      />
                      <button
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="px-3 border-2 border-stone-900 bg-white hover:bg-stone-100"
                      >
                        {showApiKey ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  {/* Model */}
                  <div>
                    <label className="block text-sm font-black uppercase text-stone-900 mb-2">Model</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      title="Chọn mô hình trong cài đặt"
                      aria-label="Chọn mô hình trong cài đặt"
                      className="w-full px-4 py-2 border-2 border-stone-900 bg-white text-stone-900 font-bold"
                    >
                      {MODELS_BY_PROVIDER[selectedProvider].map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Provider Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleTestConnection}
                      disabled={testingConnection || !apiKey}
                      className="flex-1 px-4 py-2 font-bold uppercase text-sm bg-white text-stone-900 border-2 border-stone-900 disabled:bg-stone-200 disabled:cursor-not-allowed"
                    >
                      {testingConnection ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={handleSaveProvider}
                      disabled={savingProvider || !apiKey}
                      className="flex-1 px-4 py-2 font-bold uppercase text-sm bg-amber-500 text-white border-2 border-stone-900 disabled:bg-stone-300 disabled:cursor-not-allowed"
                    >
                      {savingProvider ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
                {/* Model Parameters */}
                {agent && (
                  <ModelParametersConfig
                    temperature={agent.temperature}
                    maxTokens={agent.max_tokens}
                    topP={agent.top_p}
                    model={agent.model}
                    onUpdate={handleUpdateParameters}
                  />
                )}
                {/* Initial Setup Section */}
                <div className="pt-6 border-t-4 border-stone-900 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase text-red-600">
                    <ArrowPathIcon className="w-5 h-5 font-bold" />
                    Danger Zone / Setup
                  </div>
                  <p className="text-[10px] font-bold text-stone-500 uppercase">
                    Nếu bạn vừa deploy hoặc DB bị lỗi, hãy nạp lại dữ liệu khởi tạo.
                  </p>
                  <button
                    onClick={() => setShowSeedConfirm(true)}
                    disabled={seeding}
                    className="w-full px-4 py-2 font-black uppercase text-xs bg-white text-red-600 border-2 border-red-600 hover:bg-red-50 disabled:bg-stone-100 disabled:text-stone-400 disabled:border-stone-400"
                  >
                    {seeding ? 'Đang xử lý...' : 'Nạp dữ liệu mẫu (Reset)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Confirm Modal for Seed Database */}
        <ConfirmModal
          isOpen={showSeedConfirm}
          title="Xác nhận nạp dữ liệu mẫu"
          message="Bạn có chắc muốn nạp lại dữ liệu mẫu? Việc này sẽ tạo lại các Agent và Tool mặc định."
          confirmLabel="NẠP DỮ LIỆU"
          cancelLabel="HỦY BỎ"
          onConfirm={handleSeedDatabase}
          onCancel={() => setShowSeedConfirm(false)}
          isDanger
        />
        <ConfirmModal
          isOpen={!!sessionToDelete}
          title="Xác nhận xóa session"
          message={`Bạn có chắc muốn xóa session "${sessionToDelete?.title || sessionToDelete?.session_id || ''}" không? Toàn bộ lịch sử chat của session này sẽ bị xóa.`}
          confirmLabel={deletingSessionId ? 'ĐANG XÓA...' : 'XÓA SESSION'}
          cancelLabel="HỦY"
          onConfirm={handleDeleteSession}
          onCancel={() => setSessionToDelete(null)}
          isDanger
        />
      </div>
    </div>
  )
}
export default PlaygroundPage
