import { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { Agent } from '../../services/agentService'

interface AgentTreeViewProps {
  agents: Agent[]
  selectedAgentId?: number
  onSelectAgent: (agent: Agent) => void
}

/**
 * Agent Sidebar List - Flat View (Single Agent Architecture)
 * Displays all agents (personalities/specialists) in a vertical list
 */
export const AgentTreeView = ({
  agents,
  selectedAgentId,
  onSelectAgent
}: AgentTreeViewProps) => {
  const [expanded, setExpanded] = useState(true)

  const getAgentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'main':
        return (
          <div className="w-8 h-8 rounded-none border-2 border-stone-900 bg-amber-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-700" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
        )
      case 'booking':
        return (
          <div className="w-8 h-8 rounded-none border-2 border-stone-900 bg-blue-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )
      case 'medical':
        return (
          <div className="w-8 h-8 rounded-none border-2 border-stone-900 bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        )
      case 'research':
        return (
          <div className="w-8 h-8 rounded-none border-2 border-stone-900 bg-purple-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 rounded-none border-2 border-stone-900 bg-stone-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-stone-700" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        )
    }
  }

  return (
    <div className="bg-white border-4 border-stone-900 shadow-brutal h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b-4 border-stone-900 bg-stone-900 flex items-center justify-between">
        <h3 className="text-sm font-black text-white uppercase tracking-widest">NEURAL AGENTS</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 hover:bg-stone-800 rounded transition-colors text-white"
        >
          {expanded ? (
            <ChevronDownIcon className="w-4 h-4" strokeWidth={3} />
          ) : (
            <ChevronRightIcon className="w-4 h-4" strokeWidth={3} />
          )}
        </button>
      </div>

      <div className="p-4">
        {expanded && (
          <div className="space-y-4">
            <div className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-4 mt-2 px-1">
              SYSTEM NODES
            </div>
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => onSelectAgent(agent)}
                className={`
                  flex items-center gap-4 px-4 py-4 cursor-pointer transition-all border-4
                  ${selectedAgentId === agent.id
                    ? 'bg-amber-400 border-stone-900 translate-x-[-4px] translate-y-[-4px] shadow-[4px_4px_0_#1c1917]'
                    : 'bg-white border-transparent hover:bg-stone-100 hover:border-stone-900'
                  }
                `}
              >
                <div className="flex-shrink-0">
                  <div className="relative">
                    {getAgentIcon(agent.agent_type)}
                    <span className={`
                      absolute -top-1 -right-1 w-4 h-4 border-2 border-stone-900 rounded-none
                      ${agent.enabled ? 'bg-green-500' : 'bg-red-500'}
                    `} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col">
                    <span className="font-black text-stone-900 text-base uppercase tracking-tight truncate">
                      {agent.name}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-500 mt-1">
                      {agent.agent_type === 'main' ? 'COORDINATOR' : `${agent.agent_type.toUpperCase()} UNIT`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
