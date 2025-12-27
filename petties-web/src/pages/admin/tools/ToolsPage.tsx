import { useState, useEffect } from 'react'
import { toolApi } from '../../../services/agentService'
import type { Tool } from '../../../services/agentService'
import { ToolCard } from '../../../components/admin/ToolCard'
import { useToast } from '../../../components/Toast'
import { handleApiError } from '../../../utils/errorHandler'
import { ArrowPathIcon, AdjustmentsHorizontalIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

/**
 * Tool Registry & Governance Page
 * 
 * Features:
 * - View all code-based tools (FastMCP)
 * - Enable/disable tools
 * - Assign tools to agents
 * - Scan code-based tools
 */
export const ToolsPage = () => {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const toast = useToast()

  useEffect(() => {
    loadTools()
  }, [])

  const loadTools = async () => {
    try {
      setLoading(true)
      const data = await toolApi.getTools()
      setTools(data.tools)
    } catch (err) {
      console.error('Failed to load tools', err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (tool: Tool, enabled: boolean) => {
    try {
      await toolApi.toggleTool(tool.id, enabled)
      await loadTools()
      toast.showToast('success', `Tool "${tool.name}" đã được ${enabled ? 'bật' : 'tắt'}`)
    } catch (err) {
      handleApiError(err, toast, 'Không thể thay đổi trạng thái tool. Vui lòng thử lại.')
    }
  }

  const handleScan = async () => {
    try {
      const result = await toolApi.scanTools()
      await loadTools()
      toast.showToast('success', 'Quét tools thành công!')
      return result
    } catch (err) {
      handleApiError(err, toast, 'Không thể quét tools. Vui lòng thử lại.')
    }
  }

  const handleAssign = (toolId: number) => {
    // TODO: Open modal to assign tool to agents
    console.log('Assign tool', toolId)
  }

  // Filter tools by search query
  const filteredTools = tools.filter(tool => {
    const matchesSearch = searchQuery.trim() === '' || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const stats = {
    total: tools.length,
    enabled: tools.filter(t => t.enabled).length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-stone-600">Loading tools...</p>
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
              <h1 className="text-2xl font-bold text-stone-900">Tool Registry</h1>
              <p className="text-sm text-stone-500 mt-1">
                Manage and configure code-based tools for AI agents.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleScan}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
                Scan Tools
              </button>
              <button
                onClick={loadTools}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
            <div className="text-2xl font-bold text-stone-900">{stats.total}</div>
            <div className="text-sm text-stone-500 mt-1">Total Tools</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
            <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
            <div className="text-sm text-stone-500 mt-1">Enabled</div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tools by name or description..."
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
          </div>
        </div>

        {/* Tools Grid */}
        <div className="space-y-3">
          {filteredTools.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AdjustmentsHorizontalIcon className="w-8 h-8 text-stone-400" />
                </div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">No tools found</h3>
                <p className="text-sm text-stone-500">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Click "Scan Tools" to discover code-based tools from the AI service'
                  }
                </p>
              </div>
            </div>
          ) : (
            filteredTools.map(tool => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onToggle={(enabled) => handleToggle(tool, enabled)}
                onAssign={handleAssign}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ToolsPage