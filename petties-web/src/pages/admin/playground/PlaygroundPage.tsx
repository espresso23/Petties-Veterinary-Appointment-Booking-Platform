import { useState, useEffect, useRef, useCallback } from 'react'
import { agentApi, type Agent } from '../../../services/agentService'
import { ChatMessage } from '../../../components/admin/ChatMessage'
import { env } from '../../../config/env'
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
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'

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
 * Agent Playground Page
 *
 * Features:
 * - WebSocket real-time chat with SingleAgent
 * - ReAct trace visualization (Thinking -> Tool Call -> Result -> Answer)
 * - Split view: Chat + ReAct Trace Panel
 * - LLM model selector for testing different models
 */
export const PlaygroundPage = () => {
  // Agent selection
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [loadingAgents, setLoadingAgents] = useState(true)

  // LLM Provider & Model selection
  const [selectedProvider, setSelectedProvider] = useState<LLMProvider>('openrouter')
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.0-flash-exp:free')

  // Update model when provider changes
  const handleProviderChange = (provider: LLMProvider) => {
    setSelectedProvider(provider)
    // Auto-select first model of new provider
    const models = MODELS_BY_PROVIDER[provider]
    if (models.length > 0) {
      setSelectedModel(models[0].id)
    }
  }

  // WebSocket state
  const wsRef = useRef<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [sessionId] = useState(() => `playground-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ReAct trace state
  const [reactSteps, setReactSteps] = useState<ReActStep[]>([])
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [showTracePanel, setShowTracePanel] = useState(true)

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        const response = await agentApi.getAgents()
        setAgents(response.agents.filter(a => a.enabled))
        if (response.agents.length > 0) {
          setSelectedAgentId(response.agents[0].id)
        }
      } catch (error) {
        console.error('Failed to load agents:', error)
      } finally {
        setLoadingAgents(false)
      }
    }
    loadAgents()
  }, [])

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')

    // Convert HTTP to WS URL
    let wsUrl = env.AGENT_SERVICE_URL
    if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://')
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://')
    }

    const fullWsUrl = `${wsUrl}/ws/chat/${sessionId}`
    console.log('Connecting to WebSocket:', fullWsUrl)

    const ws = new WebSocket(fullWsUrl)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnectionStatus('connected')
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected')
      setConnectionStatus('disconnected')
      wsRef.current = null
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('error')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    wsRef.current = ws
  }, [sessionId])

  // Handle WebSocket messages
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
    timestamp?: string
  }) => {
    console.log('WebSocket message:', data.type, data)

    switch (data.type) {
      case 'connected':
        console.log('WebSocket session established')
        break

      case 'ack':
        // Message acknowledged, clear streaming
        setStreamingContent('')
        setReactSteps([])
        break

      case 'agent_info':
        console.log('Using agent:', data)
        break

      case 'thinking':
        // Add thinking step to trace
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'thought',
          content: data.content ?? '',
          tool_name: data.tool_name,
          tool_params: data.tool_params,
          timestamp: data.timestamp ?? new Date().toISOString()
        }])
        // Auto-expand new steps
        setExpandedSteps(prev => new Set([...prev, data.step_index ?? 0]))
        break

      case 'tool_call':
        // Add tool call to trace
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'action',
          content: data.content ?? `Calling ${data.tool_name}`,
          tool_name: data.tool_name,
          tool_params: data.tool_params,
          timestamp: data.timestamp ?? new Date().toISOString()
        }])
        setExpandedSteps(prev => new Set([...prev, data.step_index ?? 0]))
        break

      case 'tool_result':
        // Add observation to trace
        setReactSteps(prev => [...prev, {
          step_index: data.step_index ?? prev.length,
          step_type: 'observation',
          content: data.content ?? 'Tool result received',
          tool_name: data.tool_name,
          tool_result: data.result,
          timestamp: data.timestamp ?? new Date().toISOString()
        }])
        setExpandedSteps(prev => new Set([...prev, data.step_index ?? 0]))
        break

      case 'stream':
        // Stream token to current response
        setStreamingContent(prev => prev + (data.content ?? ''))
        break

      case 'complete':
        // Final response
        setSending(false)
        setStreamingContent('')

        // Extract thinking and tool calls from react_trace
        const thinkingProcess: string[] = []
        const toolCalls: Array<{ tool: string; input: unknown; output?: unknown }> = []

        if (data.react_trace) {
          for (const step of data.react_trace) {
            if (step.step_type === 'thought' && step.content) {
              thinkingProcess.push(step.content)
            }
            if (step.step_type === 'action' && step.tool_name) {
              toolCalls.push({
                tool: step.tool_name,
                input: step.tool_params ?? {},
                output: undefined
              })
            }
            if (step.step_type === 'observation' && toolCalls.length > 0) {
              toolCalls[toolCalls.length - 1].output = step.tool_result
            }
          }
        }

        // Add assistant message
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.full_response ?? '',
          timestamp: new Date(),
          thinkingProcess,
          toolCalls
        }])
        break

      case 'error':
        // Error occurred
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

  // Connect on mount
  useEffect(() => {
    connectWebSocket()
    return () => {
      wsRef.current?.close()
    }
  }, [connectWebSocket])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Send message via WebSocket
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

    // Send via WebSocket with provider + model selection
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
      if (next.has(stepIndex)) {
        next.delete(stepIndex)
      } else {
        next.add(stepIndex)
      }
      return next
    })
  }

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'thought':
        return <CpuChipIcon className="w-4 h-4" />
      case 'action':
        return <WrenchScrewdriverIcon className="w-4 h-4" />
      case 'observation':
        return <EyeIcon className="w-4 h-4" />
      default:
        return <ChatBubbleLeftRightIcon className="w-4 h-4" />
    }
  }

  const getStepColor = (stepType: string) => {
    switch (stepType) {
      case 'thought':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'action':
        return 'bg-purple-100 text-purple-700 border-purple-300'
      case 'observation':
        return 'bg-green-100 text-green-700 border-green-300'
      default:
        return 'bg-stone-100 text-stone-700 border-stone-300'
    }
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId)

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Page Header */}
      <div className="bg-white border-b-4 border-stone-900">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-stone-900 uppercase">Agent Playground</h1>
              <p className="text-sm text-stone-600 mt-1">
                Test AI Agent với ReAct trace real-time
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <div className={`flex items-center gap-2 px-3 py-1.5 border-2 border-stone-900 ${connectionStatus === 'connected' ? 'bg-green-100' :
                connectionStatus === 'connecting' ? 'bg-yellow-100' :
                  connectionStatus === 'error' ? 'bg-red-100' : 'bg-stone-100'
                }`}>
                {connectionStatus === 'connected' ? (
                  <SignalIcon className="w-4 h-4 text-green-700" />
                ) : (
                  <SignalSlashIcon className="w-4 h-4 text-stone-700" />
                )}
                <span className="text-xs font-bold uppercase text-stone-900">
                  {connectionStatus}
                </span>
              </div>

              {/* Agent Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-stone-700 font-bold">Agent:</label>
                <select
                  value={selectedAgentId ?? ''}
                  onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                  disabled={loadingAgents}
                  className="px-4 py-2 border-4 border-stone-900 bg-white font-bold focus:ring-0 outline-none text-sm cursor-pointer text-stone-900 min-w-[180px]"
                >
                  {agents.map(agent => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.agent_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Provider Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-stone-700 font-bold">Provider:</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                  className="px-4 py-2 border-4 border-stone-900 bg-white font-bold focus:ring-0 outline-none text-sm cursor-pointer text-stone-900 min-w-[140px]"
                >
                  {PROVIDERS.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* LLM Model Selector */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-stone-700 font-bold">Model:</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-4 py-2 border-4 border-stone-900 bg-white font-bold focus:ring-0 outline-none text-sm cursor-pointer text-stone-900 min-w-[200px]"
                >
                  {MODELS_BY_PROVIDER[selectedProvider].map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggle Trace Panel */}
              <button
                onClick={() => setShowTracePanel(!showTracePanel)}
                className={`px-4 py-2 border-4 border-stone-900 font-bold text-sm cursor-pointer transition-colors ${showTracePanel ? 'bg-amber-400 text-stone-900' : 'bg-white text-stone-700 hover:bg-stone-100'
                  }`}
              >
                {showTracePanel ? 'Hide Trace' : 'Show Trace'}
              </button>

              <button
                onClick={clearChat}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-stone-900 bg-white border-4 border-stone-900 hover:bg-stone-100 transition-colors cursor-pointer shadow-[4px_4px_0_#1c1917] hover:shadow-[2px_2px_0_#1c1917] hover:translate-x-[2px] hover:translate-y-[2px]"
              >
                <TrashIcon className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className={`flex-1 flex flex-col ${showTracePanel ? 'border-r-4 border-stone-900' : ''}`}>
          {/* Agent Info Bar */}
          {selectedAgent && (
            <div className="px-4 py-2 bg-amber-50 border-b-2 border-stone-900 flex items-center gap-3 flex-wrap">
              <span className="text-xs text-stone-600 font-bold">AGENT:</span>
              <span className="inline-flex items-center px-2 py-0.5 bg-amber-400 border-2 border-stone-900 text-xs font-black">
                {selectedAgent.name}
              </span>
              <span className="text-xs text-stone-600 font-bold">PROVIDER:</span>
              <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 border-2 border-stone-900 text-xs font-bold text-purple-800">
                {PROVIDERS.find(p => p.id === selectedProvider)?.name || selectedProvider}
              </span>
              <span className="text-xs text-stone-600 font-bold">MODEL:</span>
              <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 border-2 border-stone-900 text-xs font-bold text-blue-800">
                {MODELS_BY_PROVIDER[selectedProvider].find(m => m.id === selectedModel)?.name || selectedModel}
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 bg-stone-100">
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
              <>
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
                  <div className="flex gap-4 justify-start mb-6">
                    <div className="flex-shrink-0 w-10 h-10 bg-amber-100 border-2 border-stone-900 flex items-center justify-center">
                      <ArrowPathIcon className="w-6 h-6 text-amber-600 animate-spin" />
                    </div>
                    <div className="flex-1 max-w-4xl">
                      <div className="text-xs font-bold text-stone-500 mb-1.5 uppercase">AI Assistant</div>
                      <div className="bg-white border-4 border-stone-900 shadow-[4px_4px_0_#1c1917] px-4 py-3">
                        {streamingContent || 'Processing...'}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
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
                aria-label="Send message"
                className="px-6 py-3 font-black text-white bg-amber-500 border-4 border-stone-900 hover:bg-amber-600 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer self-end shadow-[4px_4px_0_#1c1917] hover:shadow-[2px_2px_0_#1c1917] hover:translate-x-[2px] hover:translate-y-[2px] disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
              >
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ReAct Trace Panel */}
        {showTracePanel && (
          <div className="w-96 flex flex-col bg-white">
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
                  <div
                    key={idx}
                    className={`border-2 border-stone-900 ${getStepColor(step.step_type)}`}
                  >
                    {/* Step Header */}
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

                    {/* Step Content */}
                    {expandedSteps.has(step.step_index) && (
                      <div className="px-3 pb-3 pt-1 border-t border-current border-opacity-30">
                        <p className="text-xs whitespace-pre-wrap break-words">
                          {step.content}
                        </p>

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

            {/* Trace Summary */}
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
      </div>
    </div>
  )
}

export default PlaygroundPage
