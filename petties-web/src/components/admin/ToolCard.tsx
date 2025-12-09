import { useState } from 'react'
import {
  CodeBracketIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline'
import type { Tool } from '../../services/agentService'

interface ToolCardProps {
  tool: Tool
  onToggle: (enabled: boolean) => Promise<void>
  onAssign?: (toolId: number) => void
}

/**
 * Tool Card Component
 * Displays tool information with schema viewer and assignment controls
 */
export const ToolCard = ({ tool, onToggle, onAssign }: ToolCardProps) => {
  const [expanded, setExpanded] = useState(false)

  const getToolIcon = () => {
    if (tool.tool_type === 'code_based') {
      return <CodeBracketIcon className="w-5 h-5 text-blue-600" />
    }
    return <GlobeAltIcon className="w-5 h-5 text-amber-600" />
  }

  const getSourceBadge = () => {
    switch (tool.source) {
      case 'fastmcp_code':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
            FastMCP Code
          </span>
        )
      case 'swagger_imported':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
            Swagger Import
          </span>
        )
      case 'manual_api':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
            Manual API
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className={`
      bg-white rounded-xl border transition-all cursor-pointer
      ${tool.enabled 
        ? 'border-stone-200 shadow-soft hover:shadow-medium' 
        : 'border-stone-200 opacity-60'
      }
    `}>
      {/* Header */}
      <div 
        className="px-5 py-4 flex items-start justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={`
            flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
            ${tool.tool_type === 'code_based' ? 'bg-blue-50' : 'bg-amber-50'}
          `}>
            {getToolIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-stone-900 text-sm truncate">
                {tool.name}
              </h3>
              {getSourceBadge()}
            </div>
            {tool.description && (
              <p className="text-xs text-stone-500 line-clamp-2">
                {tool.description}
              </p>
            )}
            {tool.assigned_agents && tool.assigned_agents.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-stone-500">Assigned to:</span>
                {tool.assigned_agents.map(agent => (
                  <span 
                    key={agent}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700"
                  >
                    {agent}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Enable/Disable Toggle */}
          <label 
            className="relative inline-flex items-center cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="sr-only">Enable/Disable Tool</span>
            <input
              type="checkbox"
              checked={tool.enabled}
              onChange={async (e) => {
                e.stopPropagation()
                await onToggle(e.target.checked)
              }}
              aria-label={`Toggle ${tool.name}`}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-amber-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>

          {/* Expand Icon */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="p-1 hover:bg-stone-100 rounded transition-colors"
          >
            {expanded ? (
              <ChevronDownIcon className="w-5 h-5 text-stone-600" />
            ) : (
              <ChevronRightIcon className="w-5 h-5 text-stone-600" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content - Schema Viewer */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-stone-200 pt-4">
          <div className="space-y-4">
            {/* Request Schema */}
            <div>
              <h4 className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wider">
                Request Schema (Input)
              </h4>
              <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                <pre className="text-xs font-mono text-stone-700 overflow-x-auto">
                  {JSON.stringify({ /* TODO: Add schema from API */ }, null, 2)}
                </pre>
              </div>
            </div>

            {/* Response Schema */}
            <div>
              <h4 className="text-xs font-semibold text-stone-700 mb-2 uppercase tracking-wider">
                Response Schema (Output)
              </h4>
              <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
                <pre className="text-xs font-mono text-stone-700 overflow-x-auto">
                  {JSON.stringify({ /* TODO: Add schema from API */ }, null, 2)}
                </pre>
              </div>
            </div>

            {/* Actions */}
            {onAssign && (
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => onAssign(tool.id)}
                  className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
                >
                  Assign to Agent
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
