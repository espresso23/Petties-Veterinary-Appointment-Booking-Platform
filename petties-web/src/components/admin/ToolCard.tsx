import { useState } from 'react'
import {
  CodeBracketIcon,
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
 * Displays tool information with enable/disable toggle
 * Simplified UI - just name, description, toggle
 */
export const ToolCard = ({ tool, onToggle, onAssign }: ToolCardProps) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`
      bg-white rounded-xl border transition-all
      ${tool.enabled
        ? 'border-stone-200 shadow-soft hover:shadow-medium'
        : 'border-stone-200 opacity-60'
      }
    `}>
      {/* Header */}
      <div
        className="px-5 py-4 flex items-start justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50">
            <CodeBracketIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-stone-900 text-sm">
                {tool.name}
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                FastMCP
              </span>
            </div>
            {tool.description && !expanded && (
              <p className="text-xs text-stone-500 line-clamp-1">
                {tool.description.slice(0, 80)}...
              </p>
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

      {/* Expanded Content - Just description */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-stone-200 pt-4">
          <div className="space-y-3">
            {/* Full Description */}
            {tool.description && (
              <p className="text-sm text-stone-700 leading-relaxed">
                {tool.description}
              </p>
            )}

            {/* Assigned Agents */}
            {tool.assigned_agents && tool.assigned_agents.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-stone-500 uppercase font-semibold">Assigned to:</span>
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

            {/* Actions */}
            {onAssign && (
              <div className="pt-2">
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
