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
}

/**
 * Tool Card Component
 * Displays tool information with enable/disable toggle
 * Simplified UI - just name, description, toggle
 */
const PLAYGROUND_TESTABLE_TOOLS = new Set([
  'pet_knowledge_search',
  'web_search'
])

const SYSTEM_MANAGED_TOOLS = new Set([
  'get_user_pets',
  'search_clinics_nearby',
  'get_clinic_services',
  'check_vaccination_status',
  'check_available_slots',
  'create_booking_for_user'
])

const getToolScope = (toolName: string) => {
  if (PLAYGROUND_TESTABLE_TOOLS.has(toolName)) {
    return {
      label: 'Playground testable',
      className: 'bg-emerald-100 text-emerald-700'
    }
  }

  return {
    label: 'Business chat only',
    className: 'bg-amber-100 text-amber-700'
  }
}

export const ToolCard = ({ tool, onToggle }: ToolCardProps) => {
  const [expanded, setExpanded] = useState(false)
  const toolScope = getToolScope(tool.name)
  const isSystemManaged = SYSTEM_MANAGED_TOOLS.has(tool.name)

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
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${toolScope.className}`}>
                {toolScope.label}
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
          {!isSystemManaged && (
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
          )}

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

            <div className="pt-2">
              <p className="text-xs text-stone-500 leading-relaxed">
                {PLAYGROUND_TESTABLE_TOOLS.has(tool.name)
                  ? 'Tool này có thể bật/tắt để kiểm tra trong Playground admin vì không phụ thuộc business context hoặc side effect nghiệp vụ.'
                  : 'Tool này được hệ thống bật sẵn cho business chat. Nó cần user context thật như user, pet, clinic, JWT hoặc xác nhận booking nên không dùng để test trực tiếp trong Playground admin.'}
              </p>
              <p className="text-xs font-semibold text-stone-700 mt-2">
                {isSystemManaged
                  ? 'Trạng thái: Luôn bật theo cấu hình hệ thống của petties_agent'
                  : 'Trạng thái: Admin có thể bật/tắt để test Playground'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
