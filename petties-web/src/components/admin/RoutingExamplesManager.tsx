import { useState } from 'react'
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'

interface RoutingExample {
  id: string
  query: string
  target_agent: string
  language?: string
  created_at?: string
}

interface RoutingExamplesManagerProps {
  examples: RoutingExample[]
  onAdd: (example: Omit<RoutingExample, 'id' | 'created_at'>) => Promise<void>
  onUpdate: (id: string, example: Omit<RoutingExample, 'id' | 'created_at'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  availableAgents: string[]
}

/**
 * Dynamic Few-Shot Routing Examples Manager
 * Admin can add/edit/delete routing pairs (User Query -> Target Agent)
 * Supports multilingual examples
 */
export const RoutingExamplesManager = ({
  examples,
  onAdd,
  onUpdate,
  onDelete,
  availableAgents
}: RoutingExamplesManagerProps) => {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    query: '',
    target_agent: '',
    language: 'vi'
  })

  const handleSubmit = async () => {
    if (!formData.query.trim() || !formData.target_agent) return

    try {
      if (editingId) {
        await onUpdate(editingId, formData)
        setEditingId(null)
      } else {
        await onAdd(formData)
      }
      setFormData({ query: '', target_agent: '', language: 'vi' })
      setIsAdding(false)
    } catch (error) {
      console.error('Failed to save routing example:', error)
    }
  }

  const startEdit = (example: RoutingExample) => {
    setFormData({
      query: example.query,
      target_agent: example.target_agent,
      language: example.language || 'vi'
    })
    setEditingId(example.id)
    setIsAdding(true)
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft">
      <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Routing Examples</h3>
          <p className="text-sm text-stone-500 mt-1">
            Configure Few-Shot routing pairs for intent classification. System uses cross-lingual embeddings.
          </p>
        </div>
        <button
          onClick={() => {
            setIsAdding(true)
            setEditingId(null)
            setFormData({ query: '', target_agent: '', language: 'vi' })
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors cursor-pointer font-medium text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Add Example
        </button>
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                User Query
              </label>
              <input
                type="text"
                value={formData.query}
                onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                placeholder="e.g., Con này bị sao vậy?"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">
                Target Agent
              </label>
              <select
                value={formData.target_agent}
                onChange={(e) => setFormData({ ...formData, target_agent: e.target.value })}
                aria-label="Target Agent"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
              >
                <option value="">Select agent...</option>
                {availableAgents.map(agent => (
                  <option key={agent} value={agent}>{agent}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-stone-600">
                <span>Language:</span>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="px-2 py-1 border border-stone-300 rounded text-sm"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                  <option value="ko">한국어</option>
                  <option value="ja">日本語</option>
                </select>
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsAdding(false)
                  setEditingId(null)
                  setFormData({ query: '', target_agent: '', language: 'vi' })
                }}
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.query.trim() || !formData.target_agent}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {editingId ? 'Update' : 'Add'} Example
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Examples List */}
      <div className="divide-y divide-stone-200">
        {examples.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-stone-500 text-sm">No routing examples yet. Add your first example to get started.</p>
          </div>
        ) : (
          examples.map((example) => (
            <div key={example.id} className="px-6 py-4 hover:bg-stone-50 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-stone-900">
                      &quot;{example.query}&quot;
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                      {example.language?.toUpperCase() || 'VI'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-500">Routes to:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      {example.target_agent}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(example)}
                    className="p-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(example.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
