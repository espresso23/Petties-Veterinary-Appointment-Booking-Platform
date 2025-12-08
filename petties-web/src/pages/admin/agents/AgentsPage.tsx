import { useState, useEffect } from 'react'
import { agentApi } from '../../../services/agentService'
import type { Agent } from '../../../services/agentService'
import { AgentTreeView } from '../../../components/admin/AgentTreeView'
import { SystemPromptEditor } from '../../../components/admin/SystemPromptEditor'
import { ModelParametersConfig } from '../../../components/admin/ModelParametersConfig'
import { RoutingExamplesManager } from '../../../components/admin/RoutingExamplesManager'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

interface RoutingExample {
  id: string
  query: string
  target_agent: string
  language?: string
  created_at?: string
}

/**
 * Agent Management Page - Redesigned with Warm Neutrals Design System
 * 
 * Features:
 * - Hierarchical tree view (Main Agent + Sub-Agents)
 * - System Prompt Editor with version control
 * - Model Parameters Configuration
 * - Dynamic Few-Shot Routing Examples Manager
 */
export const AgentsPage = () => {
  const [agents, setAgents] = useState<{ main_agent?: Agent; sub_agents: Agent[] }>({ sub_agents: [] })
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'config' | 'routing'>('config')
  const [routingExamples, setRoutingExamples] = useState<RoutingExample[]>([])

  useEffect(() => {
    loadAgents()
    loadRoutingExamples()
  }, [])

  const loadAgents = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await agentApi.getAgents()
      setAgents({ main_agent: data.main_agent, sub_agents: data.sub_agents })
      
      // Auto-select main agent if available
      if (data.main_agent && !selectedAgent) {
        setSelectedAgent(data.main_agent)
      }
    } catch (err) {
      setError('Failed to load agents')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadRoutingExamples = async () => {
    // TODO: Implement API call when backend is ready
    // For now, use mock data
    setRoutingExamples([
      { id: '1', query: 'Con này bị sao vậy?', target_agent: 'Medical Agent', language: 'vi' },
      { id: '2', query: 'Có bán hạt Royal Canin không?', target_agent: 'Research Agent', language: 'vi' },
      { id: '3', query: 'My cat is vomiting', target_agent: 'Medical Agent', language: 'en' },
    ])
  }

  const handleSavePrompt = async (prompt: string, versionNote?: string) => {
    if (!selectedAgent) return
    await agentApi.updatePrompt(selectedAgent.id, prompt, versionNote)
    await loadAgents()
  }

  const handleUpdateParameters = async (params: { temperature?: number; max_tokens?: number; top_p?: number }) => {
    if (!selectedAgent) return
    await agentApi.updateAgent(selectedAgent.id, params)
    await loadAgents()
    // Update selected agent state
    const updated = await agentApi.getAgent(selectedAgent.id)
    setSelectedAgent(updated)
  }

  const handleAddRoutingExample = async (example: Omit<RoutingExample, 'id' | 'created_at'>) => {
    // TODO: Implement API call
    const newExample: RoutingExample = {
      id: Date.now().toString(),
      ...example,
      created_at: new Date().toISOString()
    }
    setRoutingExamples([...routingExamples, newExample])
  }

  const handleUpdateRoutingExample = async (id: string, example: Omit<RoutingExample, 'id' | 'created_at'>) => {
    // TODO: Implement API call
    setRoutingExamples(routingExamples.map(e => e.id === id ? { ...e, ...example } : e))
  }

  const handleDeleteRoutingExample = async (id: string) => {
    // TODO: Implement API call
    setRoutingExamples(routingExamples.filter(e => e.id !== id))
  }

  const availableAgents = [
    'Main Agent',
    'Medical Agent',
    'Booking Agent',
    'Research Agent'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-stone-600">Loading agents...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <button
            onClick={loadAgents}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Agent Management</h1>
              <p className="text-sm text-stone-500 mt-1">
                Configure and manage AI agents, system prompts, and routing rules
              </p>
            </div>
            <button
              onClick={loadAgents}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Agent Tree */}
          <div className="lg:col-span-1">
            <AgentTreeView
              mainAgent={agents.main_agent}
              subAgents={agents.sub_agents}
              selectedAgentId={selectedAgent?.id.toString()}
              onSelectAgent={setSelectedAgent}
            />
          </div>

          {/* Right Content - Agent Details */}
          <div className="lg:col-span-2 space-y-6">
            {selectedAgent ? (
              <>
                {/* Tab Navigation */}
                {selectedAgent.agent_type === 'main' && (
                  <div className="bg-white rounded-xl border border-stone-200 shadow-soft overflow-hidden">
                    <div className="flex border-b border-stone-200">
                      <button
                        onClick={() => setActiveTab('config')}
                        className={`
                          flex-1 px-6 py-3 text-sm font-medium transition-colors
                          ${activeTab === 'config'
                            ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-500'
                            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                          }
                        `}
                      >
                        Configuration
                      </button>
                      <button
                        onClick={() => setActiveTab('routing')}
                        className={`
                          flex-1 px-6 py-3 text-sm font-medium transition-colors
                          ${activeTab === 'routing'
                            ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-500'
                            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                          }
                        `}
                      >
                        Routing Examples
                      </button>
                    </div>
                  </div>
                )}

                {/* Configuration Tab */}
                {activeTab === 'config' && (
                  <div className="space-y-6">
                    {/* Agent Info Card */}
                    <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-stone-900">{selectedAgent.name}</h2>
                          <p className="text-sm text-stone-500 mt-1">{selectedAgent.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`
                            inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                            ${selectedAgent.agent_type === 'main' ? 'bg-amber-100 text-amber-700' :
                              selectedAgent.agent_type === 'booking' ? 'bg-blue-100 text-blue-700' :
                              selectedAgent.agent_type === 'medical' ? 'bg-green-100 text-green-700' :
                              'bg-purple-100 text-purple-700'}
                          `}>
                            {selectedAgent.agent_type}
                          </span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <span className="sr-only">Enable/Disable Agent</span>
                            <input
                              type="checkbox"
                              checked={selectedAgent.enabled}
                              onChange={async (e) => {
                                await agentApi.updateAgent(selectedAgent.id, { enabled: e.target.checked })
                                await loadAgents()
                              }}
                              className="sr-only peer"
                              aria-label="Toggle agent enabled status"
                            />
                            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* System Prompt Editor */}
                    <SystemPromptEditor
                      prompt={selectedAgent.system_prompt || ''}
                      onSave={handleSavePrompt}
                      agentName={selectedAgent.name}
                      readonly={!selectedAgent.enabled}
                    />

                    {/* Model Parameters */}
                    <ModelParametersConfig
                      temperature={selectedAgent.temperature}
                      maxTokens={selectedAgent.max_tokens}
                      model={selectedAgent.model}
                      onUpdate={handleUpdateParameters}
                      readonly={!selectedAgent.enabled}
                    />
                  </div>
                )}

                {/* Routing Examples Tab (Main Agent only) */}
                {activeTab === 'routing' && selectedAgent.agent_type === 'main' && (
                  <RoutingExamplesManager
                    examples={routingExamples}
                    onAdd={handleAddRoutingExample}
                    onUpdate={handleUpdateRoutingExample}
                    onDelete={handleDeleteRoutingExample}
                    availableAgents={availableAgents}
                  />
                )}
              </>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900 mb-2">No Agent Selected</h3>
                  <p className="text-sm text-stone-500">
                    Select an agent from the tree view to view and edit its configuration
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AgentsPage