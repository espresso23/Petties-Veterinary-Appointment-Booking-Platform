import { useState } from 'react'
import { MagnifyingGlassIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import type { QueryResult } from '../../services/agentService'

interface RAGQueryTesterProps {
  onQuery: (query: string, topK?: number) => Promise<QueryResult[]>
}

/**
 * RAG Query Tester Component
 * Tests retrieval from knowledge base and displays results
 */
export const RAGQueryTester = ({ onQuery }: RAGQueryTesterProps) => {
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [results, setResults] = useState<QueryResult[]>([])
  const [querying, setQuerying] = useState(false)

  const handleQuery = async () => {
    if (!query.trim()) return

    setQuerying(true)
    try {
      const res = await onQuery(query, topK)
      setResults(res)
    } catch (error) {
      console.error('Query failed:', error)
      setResults([])
    } finally {
      setQuerying(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft">
      <div className="px-6 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <MagnifyingGlassIcon className="w-5 h-5 text-stone-600" />
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Test RAG Retrieval</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              Query the knowledge base to see retrieved chunks
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Query Input */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Query
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleQuery()
                }
              }}
              placeholder="e.g., Triệu chứng chó bị nôn? Hoặc: Cách chăm sóc mèo con..."
              rows={3}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm resize-y"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-stone-700">Top-K:</label>
              <select
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                aria-label="Top-K results"
                className="px-3 py-1.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm cursor-pointer"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
            <button
              onClick={handleQuery}
              disabled={querying || !query.trim()}
              className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              {querying ? 'Searching...' : 'Search'}
            </button>
          </div>
          <p className="text-xs text-stone-500">
            Press <kbd className="px-1.5 py-0.5 bg-stone-100 rounded text-xs">Cmd/Ctrl + Enter</kbd> to search
          </p>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="pt-4 border-t border-stone-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-stone-900">
                Results ({results.length} chunks)
              </h4>
              <span className="text-xs text-stone-500">
                Sorted by relevance
              </span>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={`${result.document_id}-${result.chunk_index}`}
                  className="p-4 bg-stone-50 rounded-lg border border-stone-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <DocumentTextIcon className="w-4 h-4 text-stone-500" />
                      <span className="text-xs font-medium text-stone-700">
                        {result.document_name}
                      </span>
                      <span className="text-xs text-stone-500">
                        Chunk #{result.chunk_index}
                      </span>
                    </div>
                    <span className={`
                      inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                      ${result.score > 0.8 ? 'bg-green-100 text-green-700' :
                        result.score > 0.6 ? 'bg-amber-100 text-amber-700' :
                        'bg-stone-100 text-stone-700'}
                    `}>
                      {(result.score * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">
                    {result.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!querying && results.length === 0 && query && (
          <div className="pt-4 border-t border-stone-200 text-center py-8">
            <p className="text-sm text-stone-500">
              No results found. Try a different query or check if documents are processed.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
