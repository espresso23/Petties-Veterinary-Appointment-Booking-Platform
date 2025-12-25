import { useState, useEffect } from 'react'
import { agentApi } from '../../../services/agentService'
import type { Agent } from '../../../services/agentService'
import { AgentTreeView } from '../../../components/admin/AgentTreeView'
import { SystemPromptEditor } from '../../../components/admin/SystemPromptEditor'
import { ModelParametersConfig } from '../../../components/admin/ModelParametersConfig'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

/**
 * Agent Management Page - Simplified for Single Agent Architecture
 * 
 * Features:
 * - Side list of available agents/personalities
 * - System Prompt Editor with version control
 * - Model Parameters Configuration (Temp, Max Tokens, Top-P)
 * - Neobrutalism Design System
 */
export const AgentsPage = () => {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await agentApi.getAgents()
      setAgents(data.agents)

      // Auto-select first agent if available
      if (data.agents.length > 0 && !selectedAgent) {
        setSelectedAgent(data.agents[0])
      }
    } catch (err) {
      setError('Failed to connect to AI Service')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePrompt = async (prompt: string, versionNote?: string) => {
    if (!selectedAgent) return
    try {
      await agentApi.updatePrompt(selectedAgent.id, prompt, versionNote)
      // Refresh only the selected agent details
      const updated = await agentApi.getAgent(selectedAgent.id)
      setSelectedAgent(updated)
      // Also refresh the list to keep in sync
      const data = await agentApi.getAgents()
      setAgents(data.agents)
    } catch (err) {
      console.error('Failed to save prompt:', err)
    }
  }

  const handleUpdateParameters = async (params: { temperature?: number; max_tokens?: number; top_p?: number }) => {
    if (!selectedAgent) return
    try {
      await agentApi.updateAgent(selectedAgent.id, params)
      const updated = await agentApi.getAgent(selectedAgent.id)
      setSelectedAgent(updated)
      const data = await agentApi.getAgents()
      setAgents(data.agents)
    } catch (err) {
      console.error('Failed to update parameters:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-vh-100 bg-[#FAF9F6]">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 animate-spin text-amber-500 mx-auto mb-6" strokeWidth={3} />
          <h2 className="text-xl font-black text-stone-900 uppercase tracking-widest">Initalizing Neural Core...</h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] p-8 flex items-center justify-center">
        <div className="max-w-md w-full card-brutal bg-red-50 p-10 text-center border-stone-900">
          <div className="w-20 h-20 bg-red-100 border-4 border-stone-900 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-stone-900 uppercase mb-2">Service Offline</h2>
          <p className="text-stone-600 font-bold uppercase tracking-tight text-sm mb-8">{error}</p>
          <button
            onClick={loadAgents}
            className="w-full btn-brutal bg-stone-900 !text-white h-14"
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] p-4 lg:p-10">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b-8 border-stone-900">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="px-3 py-1 bg-amber-400 border-4 border-stone-900 text-xs font-black uppercase tracking-widest">v1.1.0 Cloud</span>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-[0.3em]">Neural Management System</span>
            </div>
            <h1 className="text-5xl lg:text-7xl font-black text-stone-900 uppercase tracking-tighter leading-none">
              AGENT CORE
            </h1>
            <p className="text-xl font-bold text-stone-500 mt-4 uppercase tracking-tighter">
              Orchestrate single-agent neural logic and system behaviors
            </p>
          </div>
          <button
            onClick={loadAgents}
            className="btn-brutal bg-amber-400 !text-stone-900 h-16 px-8 flex items-center gap-3"
          >
            <ArrowPathIcon className="w-6 h-6" strokeWidth={3} />
            <span className="font-black">SYNC HUB</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <AgentTreeView
              agents={agents}
              selectedAgentId={selectedAgent?.id}
              onSelectAgent={setSelectedAgent}
            />
          </div>

          {/* Configuration Area */}
          <div className="lg:col-span-8">
            {selectedAgent ? (
              <div className="space-y-10">
                {/* Header & Status Card */}
                <div className="bg-stone-900 border-4 border-stone-900 shadow-brutal p-8 flex flex-col sm:flex-row justify-between items-center gap-6">
                  <div className="text-center sm:text-left">
                    <div className="flex items-center gap-3 mb-3 justify-center sm:justify-start">
                      <span className="px-2 py-0.5 bg-amber-400 text-stone-900 text-[10px] font-black uppercase border-2 border-stone-900">
                        {selectedAgent.agent_type.toUpperCase()} UNIT
                      </span>
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-widest">ID: {selectedAgent.id}</span>
                    </div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter leading-tight">
                      {selectedAgent.name}
                    </h2>
                    <p className="text-amber-100 font-bold text-sm mt-2 opacity-80 uppercase tracking-tight">
                      {selectedAgent.description || "Active Neural Logic Processor"}
                    </p>
                  </div>

                  <div className="flex flex-col items-center sm:items-end gap-3">
                    <span className={`text-xs font-black uppercase tracking-widest ${selectedAgent.enabled ? 'text-green-400' : 'text-red-400'}`}>
                      {selectedAgent.enabled ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
                    </span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAgent.enabled}
                        onChange={async (e) => {
                          await agentApi.updateAgent(selectedAgent.id, { enabled: e.target.checked })
                          await loadAgents()
                        }}
                        className="sr-only peer"
                        aria-label="Toggle agent"
                      />
                      <div className="w-16 h-10 bg-stone-700 border-4 border-white-900 rounded-none peer-focus:outline-none after:content-[''] after:absolute after:top-1.5 after:left-1.5 after:bg-white after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500 peer-checked:after:translate-x-6"></div>
                    </label>
                  </div>
                </div>

                {/* Performance Tuning Label */}
                <div className="flex items-center gap-4">
                  <div className="h-1 flex-1 bg-stone-200"></div>
                  <span className="text-xs font-black text-stone-400 uppercase tracking-[0.4em]">Neural Config</span>
                  <div className="h-1 flex-1 bg-stone-200"></div>
                </div>

                {/* Prompt Editor */}
                <SystemPromptEditor
                  prompt={selectedAgent.system_prompt || ''}
                  onSave={handleSavePrompt}
                  agentName={selectedAgent.name}
                  readonly={!selectedAgent.enabled}
                />

                {/* Parameter Config */}
                <ModelParametersConfig
                  temperature={selectedAgent.temperature}
                  maxTokens={selectedAgent.max_tokens}
                  topP={selectedAgent.top_p}
                  model={selectedAgent.model}
                  onUpdate={handleUpdateParameters}
                  readonly={!selectedAgent.enabled}
                />
              </div>
            ) : (
              <div className="card-brutal p-24 bg-white text-center border-dashed border-stone-300">
                <div className="max-w-sm mx-auto">
                  <div className="w-24 h-24 bg-stone-50 border-4 border-dashed border-stone-200 flex items-center justify-center mx-auto mb-8">
                    <ArrowPathIcon className="w-12 h-12 text-stone-200" />
                  </div>
                  <h3 className="text-2xl font-black text-stone-900 uppercase tracking-tight mb-3">Target Not Found</h3>
                  <p className="text-base font-bold text-stone-400 uppercase tracking-tight leading-relaxed">
                    Select a neural node from the hierarchy to access its configuration matrix.
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