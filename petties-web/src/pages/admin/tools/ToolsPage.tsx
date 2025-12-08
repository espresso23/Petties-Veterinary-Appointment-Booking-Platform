import { useState, useEffect } from 'react'
import { toolApi } from '../../../services/agentService'
import type { Tool } from '../../../services/agentService'
import { ToolCard } from '../../../components/admin/ToolCard'
import { SwaggerImporter } from '../../../components/admin/SwaggerImporter'
import { ArrowPathIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'

/**
 * Tool Registry & Governance Page
 * 
 * Features:
 * - View all tools (code-based + API-based)
 * - Enable/disable tools
 * - Assign tools to agents
 * - Import from Swagger/OpenAPI
 * - Scan code-based tools
 */
export const ToolsPage = () => {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'code_based' | 'api_based'>('all')
  const [searchQuery, setSearchQuery] = useState('')

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
    } catch (err) {
      console.error('Failed to toggle tool', err)
      alert('Failed to toggle tool')
    }
  }

  const handleImport = async (url: string) => {
    const result = await toolApi.importSwagger(url)
    await loadTools()
    return result
  }

  const handleScan = async () => {
    const result = await toolApi.scanTools()
    await loadTools()
    return result
  }

  const handleAssign = (toolId: number) => {
    // TODO: Open modal to assign tool to agents
    console.log('Assign tool', toolId)
  }

  // Filter tools
  const filteredTools = tools.filter(tool => {
    const matchesFilter = filter === 'all' || tool.tool_type === filter
    const matchesSearch = searchQuery.trim() === '' || 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const stats = {
    total: tools.length,
    codeBased: tools.filter(t => t.tool_type === 'code_based').length,
    apiBased: tools.filter(t => t.tool_type === 'api_based').length,
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
                Manage and configure tools for AI agents. Import from Swagger or scan code-based tools.
              </p>
            </div>
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Import Section */}
        <SwaggerImporter onImport={handleImport} onScan={handleScan} />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
            <div className="text-2xl font-bold text-stone-900">{stats.total}</div>
            <div className="text-sm text-stone-500 mt-1">Total Tools</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
            <div className="text-2xl font-bold text-blue-600">{stats.codeBased}</div>
            <div className="text-sm text-stone-500 mt-1">Code-based</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
            <div className="text-2xl font-bold text-amber-600">{stats.apiBased}</div>
            <div className="text-sm text-stone-500 mt-1">API-based</div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
            <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
            <div className="text-sm text-stone-500 mt-1">Enabled</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tools by name or description..."
                  className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-3">
              <AdjustmentsHorizontalIcon className="w-5 h-5 text-stone-500" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                aria-label="Filter tools by type"
                className="px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm cursor-pointer"
              >
                <option value="all">All Types</option>
                <option value="code_based">Code-based</option>
                <option value="api_based">API-based</option>
              </select>
            </div>
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
                  {searchQuery || filter !== 'all'
                    ? 'Try adjusting your filters or search query'
                    : 'Import tools from Swagger or scan code-based tools to get started'
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