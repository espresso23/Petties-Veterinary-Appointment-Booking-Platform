import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { Agent } from '../../services/agentService'

interface AgentTreeViewProps {
  mainAgent?: Agent
  subAgents: Agent[]
  selectedAgentId?: string
  onSelectAgent: (agent: Agent) => void
}

/**
 * Hierarchical Tree View for Agents
 * Displays Main Agent (Supervisor) at top, Sub-Agents below
 */
export const AgentTreeView = ({ 
  mainAgent, 
  subAgents, 
  selectedAgentId,
  onSelectAgent 
}: AgentTreeViewProps) => {
  const [expanded, setExpanded] = useState(true)

  const getAgentIcon = (type: string) => {
    switch (type) {
      case 'main':
        return (
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )
      case 'booking':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )
      case 'medical':
        return (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        )
      case 'research':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Agent Hierarchy</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-stone-100 rounded transition-colors"
        >
          {expanded ? (
            <ChevronDownIcon className="w-4 h-4 text-stone-600" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-stone-600" />
          )}
        </button>
      </div>

      <div className="p-2">
        {/* Main Agent */}
        {mainAgent && (
          <div
            onClick={() => onSelectAgent(mainAgent)}
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2 cursor-pointer transition-all
              ${selectedAgentId === mainAgent.id
                ? 'bg-amber-50 border-2 border-amber-500 shadow-medium'
                : 'hover:bg-stone-50 border-2 border-transparent'
              }
            `}
          >
            <div className="flex-shrink-0">
              {getAgentIcon('main')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-900 text-sm truncate">
                  {mainAgent.name}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                  Supervisor
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">Main Agent / Orchestrator</p>
            </div>
            <div className="flex-shrink-0">
              <span className={`
                inline-block w-2.5 h-2.5 rounded-full
                ${mainAgent.enabled ? 'bg-green-500' : 'bg-stone-300'}
              `} />
            </div>
          </div>
        )}

        {/* Sub-Agents */}
        {expanded && subAgents.length > 0 && (
          <div className="ml-4 pl-4 border-l-2 border-stone-200 space-y-1">
            <div className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2 mt-1">
              Sub-Agents
            </div>
            {subAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => onSelectAgent(agent)}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all
                  ${selectedAgentId === agent.id
                    ? 'bg-amber-50 border-2 border-amber-500 shadow-medium'
                    : 'hover:bg-stone-50 border-2 border-transparent'
                  }
                `}
              >
                <div className="flex-shrink-0">
                  {getAgentIcon(agent.agent_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-900 text-sm truncate">
                      {agent.name}
                    </span>
                    <span className={`
                      inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      ${agent.agent_type === 'booking' ? 'bg-blue-100 text-blue-700' :
                        agent.agent_type === 'medical' ? 'bg-green-100 text-green-700' :
                        agent.agent_type === 'research' ? 'bg-purple-100 text-purple-700' :
                        'bg-stone-100 text-stone-700'}
                    `}>
                      {agent.agent_type}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">Worker Agent</p>
                </div>
                <div className="flex-shrink-0">
                  <span className={`
                    inline-block w-2 h-2 rounded-full
                    ${agent.enabled ? 'bg-green-500' : 'bg-stone-300'}
                  `} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
