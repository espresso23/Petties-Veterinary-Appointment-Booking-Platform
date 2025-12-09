import { useState, useEffect, useRef } from 'react'
import { agentApi } from '../../../services/agentService'
import type { Agent } from '../../../services/agentService'
import { ChatMessage } from '../../../components/admin/ChatMessage'
import { AgentFlowVisualization } from '../../../components/admin/AgentFlowVisualization'
import { ArrowPathIcon, ArrowRightIcon, TrashIcon } from '@heroicons/react/24/outline'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  citations?: Array<{ type: 'rag' | 'web'; source: string; url?: string }>
  thinkingProcess?: string[]
  toolCalls?: Array<{ tool: string; input: any; output?: any }>
  feedback?: 'good' | 'bad' | null
}

interface FlowNode {
  id: string
  type: 'user' | 'main' | 'sub' | 'tool'
  label: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  timestamp?: Date
}

interface FlowEdge {
  from: string
  to: string
  label?: string
}

/**
 * Agent Playground Page
 * 
 * Features:
 * - Interactive chat simulator
 * - Real-time WebSocket streaming
 * - Hierarchical flow visualization
 * - Thinking process log
 * - Citation view
 * - Response feedback
 */
export const PlaygroundPage = () => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>([])
  const [flowEdges, setFlowEdges] = useState<FlowEdge[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadAgents = async () => {
    try {
      const data = await agentApi.getAgents()
      const allAgents = data.main_agent
        ? [data.main_agent, ...data.sub_agents]
        : data.sub_agents
      setAgents(allAgents)
      if (allAgents.length > 0 && !selectedAgent) {
        setSelectedAgent(allAgents[0])
      }
    } catch (err) {
      console.error('Failed to load agents', err)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent || sending) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setSending(true)

    // Add user node to flow
    setFlowNodes([{ id: 'user', type: 'user', label: 'User', status: 'completed' }])

    try {
      // TODO: Use WebSocket for streaming response with thinking process
      // For now, use simple API call
      const response = await agentApi.testAgent(selectedAgent.id, userMessage.content)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        // Mock data - will come from WebSocket in production
        citations: [],
        thinkingProcess: [],
        toolCalls: []
      }

      setMessages(prev => [...prev, assistantMessage])
      
      // Update flow
      setFlowNodes([
        { id: 'user', type: 'user', label: 'User', status: 'completed' },
        { id: 'main', type: selectedAgent.agent_type === 'main' ? 'main' : 'sub', label: selectedAgent.name, status: 'completed' }
      ])
    } catch (err) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '[Error] Failed to get response from agent',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setSending(false)
    }
  }

  const handleFeedback = (messageId: string, feedback: 'good' | 'bad') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    ))
    // TODO: Send feedback to backend for training/improvement
  }

  const clearChat = () => {
    setMessages([])
    setFlowNodes([])
    setFlowEdges([])
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Page Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Agent Playground</h1>
              <p className="text-sm text-stone-500 mt-1">
                Test and debug AI agents with real-time visualization
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Agent Selector */}
              <select
                value={selectedAgent?.id || ''}
                onChange={(e) => {
                  const agent = agents.find(a => a.id === Number(e.target.value))
                  setSelectedAgent(agent || null)
                }}
                className="px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm cursor-pointer"
                aria-label="Select agent"
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.agent_type === 'main' ? '👑 ' : ''}
                    {agent.name} ({agent.agent_type})
                  </option>
                ))}
              </select>
              <button
                onClick={clearChat}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer"
              >
                <TrashIcon className="w-4 h-4" />
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left Column - Chat */}
        <div className="lg:col-span-2 flex flex-col bg-white rounded-xl border border-stone-200 shadow-soft overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 bg-stone-50">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-stone-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900 mb-2">Start a Conversation</h3>
                  <p className="text-sm text-stone-500">
                    Select an agent and type a message to begin testing
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
                    citations={msg.citations}
                    thinkingProcess={msg.thinkingProcess}
                    toolCalls={msg.toolCalls}
                    feedback={msg.feedback}
                    onFeedback={(feedback) => handleFeedback(msg.id, feedback)}
                  />
                ))}
                {sending && (
                  <div className="flex gap-4 justify-start mb-6">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <ArrowPathIcon className="w-6 h-6 text-amber-600 animate-spin" />
                    </div>
                    <div className="flex-1 max-w-4xl">
                      <div className="text-xs font-medium text-stone-500 mb-1.5">Assistant</div>
                      <div className="bg-white border border-stone-200 shadow-soft rounded-2xl px-4 py-3 text-stone-500 italic">
                        Thinking...
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-stone-200 bg-white">
            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                rows={3}
                disabled={sending || !selectedAgent}
                className="flex-1 px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm resize-none disabled:bg-stone-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !input.trim() || !selectedAgent}
                aria-label="Send message"
                className="px-6 py-3 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer self-end"
              >
                <ArrowRightIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Press <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-xs">Enter</kbd> to send, 
              <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-xs ml-1">Shift+Enter</kbd> for new line
            </p>
          </div>
        </div>

        {/* Right Column - Debug Panel */}
        <div className="lg:col-span-1 space-y-6 overflow-y-auto">
          {/* Flow Visualization */}
          <AgentFlowVisualization nodes={flowNodes} edges={flowEdges} />

          {/* Agent Info */}
          {selectedAgent && (
            <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-6">
              <h3 className="text-lg font-semibold text-stone-900 mb-4">Agent Info</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-stone-500">Name:</span>
                  <span className="ml-2 font-medium text-stone-900">{selectedAgent.name}</span>
                </div>
                <div>
                  <span className="text-stone-500">Type:</span>
                  <span className="ml-2 font-medium text-stone-900">{selectedAgent.agent_type}</span>
                </div>
                <div>
                  <span className="text-stone-500">Model:</span>
                  <span className="ml-2 font-mono text-xs text-stone-700">{selectedAgent.model}</span>
                </div>
                <div>
                  <span className="text-stone-500">Temperature:</span>
                  <span className="ml-2 font-medium text-stone-900">{selectedAgent.temperature}</span>
                </div>
                <div>
                  <span className="text-stone-500">Max Tokens:</span>
                  <span className="ml-2 font-medium text-stone-900">{selectedAgent.max_tokens}</span>
                </div>
                {selectedAgent.tools && selectedAgent.tools.length > 0 && (
                  <div>
                    <span className="text-stone-500">Tools:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {selectedAgent.tools.map(tool => (
                        <span key={tool} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlaygroundPage