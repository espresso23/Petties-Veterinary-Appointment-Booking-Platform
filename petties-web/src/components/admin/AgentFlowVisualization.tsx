import { useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

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

interface AgentFlowVisualizationProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

/**
 * Agent Flow Visualization Component
 * Displays hierarchical agent execution flow
 * TODO: Replace with React Flow for interactive visualization
 */
export const AgentFlowVisualization = ({ nodes, edges: _edges }: AgentFlowVisualizationProps) => {
  const [expanded, setExpanded] = useState(true)

  const getNodeColor = (status: FlowNode['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 border-green-500 text-green-700'
      case 'processing':
        return 'bg-amber-100 border-amber-500 text-amber-700'
      case 'error':
        return 'bg-red-100 border-red-500 text-red-700'
      default:
        return 'bg-stone-100 border-stone-300 text-stone-700'
    }
  }

  const getNodeIcon = (type: FlowNode['type']) => {
    switch (type) {
      case 'user':
        return 'U'
      case 'main':
        return 'M'
      case 'sub':
        return 'S'
      case 'tool':
        return 'T'
      default:
        return '●'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft">
      <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Execution Flow</h3>
          <p className="text-sm text-stone-500 mt-0.5">
            Hierarchical visualization of agent handoffs and tool calls
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          aria-label={expanded ? 'Collapse flow' : 'Expand flow'}
          className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowPathIcon className={`w-4 h-4 text-stone-600 transition-transform ${expanded ? '' : 'rotate-180'}`} />
        </button>
      </div>

      {expanded && (
        <div className="p-6">
          {nodes.length === 0 ? (
            <div className="text-center py-12 text-sm text-stone-500">
              No execution flow data. Start a conversation to see agent interactions.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Simple Flow Representation */}
              <div className="flex items-center gap-3 flex-wrap">
                {nodes.map((node, idx) => (
                  <div key={node.id} className="flex items-center gap-3">
                    <div className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium text-sm
                      ${getNodeColor(node.status)}
                    `}>
                      <span>{getNodeIcon(node.type)}</span>
                      <span>{node.label}</span>
                    </div>
                    {idx < nodes.length - 1 && (
                      <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>

              {/* Flow Details */}
              <div className="mt-4 p-4 bg-stone-50 rounded-lg border border-stone-200">
                <p className="text-xs font-semibold text-stone-700 mb-2">Flow Path:</p>
                <div className="text-xs text-stone-600 font-mono">
                  {nodes.map((node, idx) => (
                    <span key={node.id}>
                      {node.label}
                      {idx < nodes.length - 1 && ' → '}
                    </span>
                  ))}
                </div>
              </div>

              {/* Info Notice */}
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Coming Soon:</strong> Interactive React Flow visualization with detailed node inspection, 
                  timeline view, and tool call details.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
