import { useState, useEffect, useRef, useCallback } from 'react'
import { agentApi, type Agent } from '../../../services/agentService'
import { ChatMessage } from '../../../components/admin/ChatMessage'
import { ModelParametersConfig } from '../../../components/admin/ModelParametersConfig'
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
  DocumentTextIcon,
  ClockIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline'

const AI_SERVICE_URL = env.AGENT_SERVICE_URL

// Get auth headers
const getAuthHeaders = (): Record<string, string> => {
  const token = useAuthStore.getState().accessToken
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
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

interface PromptVersion {
  version: number
  prompt_text: string
  notes?: string
  created_by: string
  created_at: string
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'
type LLMProvider = 'openrouter' | 'deepseek'

// Available LLM providers
const PROVIDERS: Array<{ id: LLMProvider; name: string; description: string }> = [
  { id: 'openrouter', name: 'OpenRouter', description: 'Multi-model API (Gemini, Claude, Llama, GPT)' },
  { id: 'deepseek', name: 'DeepSeek', description: 'DeepSeek Chat & Coder' },
]

// Models per provider
const MODELS_BY_PROVIDER: Record<LLMProvider, Array<{ id: string; name: string }>> = {
  openrouter: [
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
    { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash Preview' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-coder', name: 'DeepSeek Coder' },
  ],
}

/**
 * Agent Playground Page (Merged with Agent Settings)
 *
 * Features:
 * - WebSocket real-time chat with SingleAgent
 * - ReAct trace visualization (Thinking -> Tool Call -> Result -> Answer)
 * - Split view: Chat + ReAct Trace Panel
 * - Settings Panel: LLM config, API Key, Model Parameters, System Prompt
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
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.0-flash-exp:free')

  // Settings Panel State
  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [providerKeys, setProviderKeys] = useState<Record<LLMProvider, string>>({
    openrouter: '',
    deepseek: ''
  })
  const [savingProvider, setSavingProvider] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)

  // System Prompt State
  const [systemPrompt, setSystemPrompt] = useState('')
  const [promptNotes, setPromptNotes] = useState('')
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [savingPrompt, setSavingPrompt] = useState(false)
  const [showPromptHistory, setShowPromptHistory] = useState(false)
  const [promptHistory, setPromptHistory] = useState<PromptVersion[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionId] = useState(() => `playground-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // ReAct trace state
  const [reactSteps, setReactSteps] = useState<ReActStep[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [debugLogs, setDebugLogs] = useState<any[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [showTracePanel, setShowTracePanel] = useState(true)
  const [debugPanelHeight, setDebugPanelHeight] = useState(40) // Default 40% height

  // ==================== LOAD DATA ====================

  // Load agents and settings on mount
  useEffect(() => {
    loadAgentData()
  }, [])

  const loadAgentData = async () => {
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
        setSystemPrompt(agentData.system_prompt || '')
        setOriginalPrompt(agentData.system_prompt || '')
        setSelectedModel(agentData.model)

        // Detect provider from model
        let provider: LLMProvider = 'openrouter'
        if (agentData.model.startsWith('deepseek') && !agentData.model.includes('openrouter')) {
          provider = 'deepseek'
        }
        setSelectedProvider(provider)

        // Load API keys
        await loadProviderSettings(provider)
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    } finally {
      setLoadingAgents(false)
    }
  }

  const loadProviderSettings = async (currentProvider?: LLMProvider) => {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings`, {
        headers: getAuthHeaders(),
      })
      if (!response.ok) throw new Error('Failed to fetch settings')

      const data = await response.json()
      const settingsList = Array.isArray(data) ? data : (data.settings || [])

      const openrouterKey = settingsList.find((s: { key: string }) => s.key === 'OPENROUTER_API_KEY')?.value || ''
      const deepseekKey = settingsList.find((s: { key: string }) => s.key === 'DEEPSEEK_API_KEY')?.value || ''

      const newKeys = { openrouter: openrouterKey, deepseek: deepseekKey }
      setProviderKeys(newKeys)

      const provider = currentProvider || selectedProvider
      setApiKey(newKeys[provider])
    } catch (err) {
      console.error('Failed to load provider settings:', err)
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
      const endpoint = selectedProvider === 'openrouter' ? '/api/v1/settings/test-openrouter' : '/api/v1/settings/test-deepseek'
      const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
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
        const apiKeyKey = selectedProvider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'DEEPSEEK_API_KEY'
        const keyResponse = await fetch(`${AI_SERVICE_URL}/api/v1/settings/${apiKeyKey}`, {
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

  // ==================== PROMPT HANDLERS ====================

  const handleSavePrompt = async () => {
    if (!agent || !systemPrompt.trim()) {
      toast.showToast('warning', 'System prompt không được để trống')
      return
    }
    try {
      setSavingPrompt(true)
      await agentApi.updatePrompt(agent.id, systemPrompt, promptNotes || undefined)
      setOriginalPrompt(systemPrompt)
      setPromptNotes('')
      if (showPromptHistory) await loadPromptHistory()
      toast.showToast('success', 'Đã lưu system prompt')
    } catch (err) {
      handleApiError(err, toast, 'Không thể lưu prompt')
    } finally {
      setSavingPrompt(false)
    }
  }

  const loadPromptHistory = async () => {
    if (!agent) return
    try {
      setLoadingHistory(true)
      const versions = await agentApi.getPromptHistory(agent.id)
      setPromptHistory(versions.slice(0, 5))
    } catch (err) {
      console.error('Failed to load history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleRestorePrompt = (version: PromptVersion) => {
    setSystemPrompt(version.prompt_text)
    setPromptNotes(`Restored from version ${version.version}`)
    toast.showToast('info', `Đã khôi phục version ${version.version}`)
  }

  const handleTogglePromptHistory = async () => {
    const newState = !showPromptHistory
    setShowPromptHistory(newState)
    if (newState && promptHistory.length === 0) await loadPromptHistory()
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

  // ==================== WEBSOCKET ====================

  const connectWebSocket = useCallback(() => {
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) return

    setConnectionStatus('connecting')
    const token = useAuthStore.getState().accessToken

    let wsUrl = env.AGENT_SERVICE_URL
    if (wsUrl.startsWith('https://')) wsUrl = wsUrl.replace('https://', 'wss://')
    else if (wsUrl.startsWith('http://')) wsUrl = wsUrl.replace('http://', 'ws://')

    const fullWsUrl = `${wsUrl}/ws/chat/${sessionId}?token=${token}`

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
        setDebugLogs(prev => [{
          id: crypto.randomUUID(),
          type: data.type,
          data: data,
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 100))
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
    wsRef.current = ws
  }, [sessionId])

  const handleWebSocketMessage = useCallback((data: {
    type: string
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
        break
      case 'ack':
        setStreamingContent('')
        setReactSteps([])
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
  }, [])

  useEffect(() => {
    connectWebSocket()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [connectWebSocket])



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
    if (!input.trim() || sending || connectionStatus !== 'connected') return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSending(true)
    setReactSteps([])

    wsRef.current?.send(JSON.stringify({
      message: userMessage.content,
      agent_id: selectedAgentId,
      provider: selectedProvider,
      model: selectedModel
    }))
  }

  const handleFeedback = (messageId: string, feedback: 'good' | 'bad') => {
    setMessages(prev => prev.map(msg =>
      msg.id === messageId ? { ...msg, feedback } : msg
    ))
  }

  const clearChat = () => {
    setMessages([])
    setReactSteps([])
    setStreamingContent('')
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

  const hasPromptChanges = systemPrompt !== originalPrompt

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
      <div className="bg-white border-b-4 border-stone-900 shrink-0">
        <div className="w-full mx-auto px-6 py-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                <h1 className="text-2xl font-black text-stone-900 uppercase tracking-tight">Agent Playground</h1>
                <p className="text-xs text-stone-600 font-bold uppercase tracking-wide">Test AI Agent với ReAct trace real-time</p>
              </div>

              {/* Status Badge in Header */}
              <div className={`flex items-center gap-2 px-3 py-1.5 border-2 border-stone-900 transition-colors shadow-[2px_2px_0_#1c1917] ${connectionStatus === 'connected' ? 'bg-green-100' :
                connectionStatus === 'connecting' ? 'bg-yellow-100' :
                  connectionStatus === 'error' ? 'bg-red-100' : 'bg-stone-50'
                }`}>
                {connectionStatus === 'connected' ? (
                  <SignalIcon className="w-4 h-4 text-green-700" />
                ) : (
                  <SignalSlashIcon className="w-4 h-4 text-stone-400" />
                )}
                <span className="text-[10px] font-black uppercase text-stone-900 tracking-tighter">
                  {connectionStatus}
                </span>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 font-black uppercase text-xs border-2 border-stone-900 transition-all cursor-pointer shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] ${showSettings ? 'bg-amber-400 text-stone-900' : 'bg-white text-stone-900 hover:bg-stone-50'}`}
              >
                <Cog6ToothIcon className="w-4 h-4" />
                Settings
              </button>

              <button
                onClick={() => setShowTracePanel(!showTracePanel)}
                className={`flex-1 md:flex-none px-4 py-2 font-black uppercase text-xs border-2 border-stone-900 transition-all cursor-pointer shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] ${showTracePanel ? 'bg-amber-400 text-stone-900' : 'bg-white text-stone-900 hover:bg-stone-50'}`}
              >
                {showTracePanel ? 'Hide Trace' : 'Show Trace'}
              </button>

              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 font-black uppercase text-xs border-2 border-stone-900 transition-all cursor-pointer shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] ${showDebug ? 'bg-purple-400 text-stone-900' : 'bg-white text-stone-900 hover:bg-stone-50'}`}
              >
                <CommandLineIcon className="w-4 h-4" />
                Logs
              </button>

              <button
                onClick={clearChat}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 font-black uppercase text-xs text-stone-900 bg-white border-2 border-stone-900 hover:bg-stone-50 transition-all cursor-pointer shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                <TrashIcon className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Controls & Info Bar */}
      <div className="px-6 py-3 bg-stone-100 border-b-4 border-stone-900 flex flex-wrap items-center gap-6 shrink-0">
        {/* Selectors Group */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-stone-500">Agent</span>
            <select
              value={selectedAgentId ?? ''}
              onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              disabled={loadingAgents}
              className="px-3 py-1.5 border-2 border-stone-900 bg-white font-black text-xs focus:ring-0 outline-none cursor-pointer text-stone-900 min-w-[140px]"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-stone-500">Provider</span>
            <select
              value={selectedProvider}
              onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
              className="px-3 py-1.5 border-2 border-stone-900 bg-white font-black text-xs focus:ring-0 outline-none cursor-pointer text-stone-900 min-w-[120px]"
            >
              {PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-stone-500">Model</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="px-3 py-1.5 border-2 border-stone-900 bg-white font-black text-xs focus:ring-0 outline-none cursor-pointer text-stone-900 min-w-[200px]"
            >
              {MODELS_BY_PROVIDER[selectedProvider].map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="h-10 w-0.5 bg-stone-300 hidden md:block"></div>

        {/* Status Group */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-stone-500 tracking-wider text-center">Status</span>
            <span className={`px-4 py-1.5 border-2 border-stone-900 font-black text-xs shadow-[2px_2px_0_#1c1917] ${agent?.enabled ? 'bg-green-400 text-stone-900' : 'bg-stone-300 text-stone-600'}`}>
              {agent?.enabled ? 'ENABLED' : 'DISABLED'}
            </span>
          </div>
        </div>
      </div>

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
                <div className="p-8 bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917]">
                  <div className="w-16 h-16 bg-amber-100 border-4 border-stone-900 flex items-center justify-center mx-auto mb-4">
                    <ChatBubbleLeftRightIcon className="w-8 h-8 text-stone-700" />
                  </div>
                  <h3 className="text-lg font-black text-stone-900 mb-2 uppercase">Start Chatting</h3>
                  <p className="text-sm text-stone-600">
                    Select an agent and send a message to see ReAct trace
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map(msg => (
                  <ChatMessage
                    key={msg.id}
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.timestamp}
                    thinkingProcess={msg.thinkingProcess}
                    toolCalls={msg.toolCalls}
                    feedback={msg.feedback}
                    onFeedback={(feedback) => handleFeedback(msg.id, feedback)}
                  />
                ))}
                {(sending || streamingContent) && (
                  <div className="flex gap-4 flex-row mb-8">
                    <div className="flex-shrink-0 w-12 h-12 border-4 border-stone-900 shadow-[4px_4px_0_#1c1917] flex items-center justify-center bg-amber-400">
                      <ArrowPathIcon className="w-7 h-7 text-stone-900 animate-spin" />
                    </div>
                    <div className="flex flex-col items-start max-w-[85%]">
                      <div className="flex items-center gap-3 mb-2 px-1">
                        <span className="text-[10px] font-black uppercase text-stone-500 tracking-widest">
                          Petties Assistant
                        </span>
                      </div>
                      <div className="relative border-4 border-stone-900 p-5 w-fit bg-white text-stone-900 shadow-[6px_6px_0_#1c1917] animate-pulse">
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
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Nhập tin nhắn... (Enter để gửi)"
                rows={3}
                disabled={sending || connectionStatus !== 'connected'}
                className="flex-1 px-4 py-3 border-4 border-stone-900 focus:ring-0 outline-none text-sm resize-none disabled:bg-stone-100 disabled:cursor-not-allowed text-stone-900 bg-white font-medium"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim() || connectionStatus !== 'connected'}
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
                            <pre className="mt-1 overflow-x-auto text-[10px] max-h-32">
                              {typeof step.tool_result === 'string'
                                ? step.tool_result.slice(0, 500)
                                : JSON.stringify(step.tool_result, null, 2).slice(0, 500)}
                              {(typeof step.tool_result === 'string' ? step.tool_result.length : JSON.stringify(step.tool_result).length) > 500 && '...'}
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
                <button onClick={() => setShowDebug(false)} className="text-stone-400 hover:text-white">
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
                <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-amber-500 rounded">
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

                {/* System Prompt */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-black uppercase text-stone-900">
                    <DocumentTextIcon className="w-5 h-5" />
                    System Prompt
                  </div>

                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={8}
                    placeholder="Enter system prompt..."
                    className="w-full px-4 py-3 border-2 border-stone-900 bg-white text-stone-900 font-mono text-sm resize-y"
                  />

                  <input
                    type="text"
                    value={promptNotes}
                    onChange={(e) => setPromptNotes(e.target.value)}
                    placeholder="Version notes (optional)..."
                    className="w-full px-4 py-2 border-2 border-stone-900 bg-white text-stone-900 text-sm"
                  />

                  {hasPromptChanges && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSystemPrompt(originalPrompt); setPromptNotes('') }}
                        className="px-4 py-2 font-bold uppercase text-sm bg-white text-stone-900 border-2 border-stone-900"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePrompt}
                        disabled={savingPrompt}
                        className="flex-1 px-4 py-2 font-bold uppercase text-sm bg-amber-500 text-white border-2 border-stone-900 disabled:bg-stone-300"
                      >
                        {savingPrompt ? 'Saving...' : 'Save Prompt'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Prompt History */}
                <div className="space-y-4">
                  <button
                    onClick={handleTogglePromptHistory}
                    className="w-full px-4 py-3 bg-stone-100 border-2 border-stone-900 flex items-center justify-between hover:bg-stone-200"
                  >
                    <div className="flex items-center gap-2">
                      <ClockIcon className="w-5 h-5" />
                      <span className="font-bold uppercase text-sm">Prompt History</span>
                    </div>
                    {showPromptHistory ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                  </button>

                  {showPromptHistory && (
                    <div className="space-y-2">
                      {loadingHistory ? (
                        <div className="text-center py-4">
                          <ArrowPathIcon className="w-6 h-6 animate-spin text-amber-600 mx-auto" />
                        </div>
                      ) : promptHistory.length === 0 ? (
                        <p className="text-center py-4 text-stone-500 text-sm">No history</p>
                      ) : (
                        promptHistory.map(v => (
                          <div key={v.version} className="p-3 bg-stone-50 border-2 border-stone-900">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="text-xs font-black text-amber-600">Version {v.version}</span>
                                <span className="text-xs text-stone-500 ml-2">
                                  {new Date(v.created_at).toLocaleString('vi-VN')}
                                </span>
                              </div>
                              <button
                                onClick={() => handleRestorePrompt(v)}
                                className="px-2 py-1 text-xs font-bold bg-stone-900 text-white"
                              >
                                Restore
                              </button>
                            </div>
                            <p className="text-xs font-mono text-stone-600 line-clamp-2">{v.prompt_text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlaygroundPage
