import { useState } from 'react'
import { KeyIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

interface ApiKey {
  key: string
  value: string
  category: string
  is_sensitive: boolean
  description?: string
}

interface ApiKeyManagerProps {
  apiKeys: ApiKey[]
  onSave: (key: string, value: string) => Promise<void>
  onTest?: (key: string) => Promise<{ status: 'success' | 'error'; message: string }>
  category: string
  categoryLabel: string
}

/**
 * API Key Manager Component
 * Manages API keys with encryption indicators and test connections
 */
export const ApiKeyManager = ({
  apiKeys,
  onSave,
  onTest,
  category,
  categoryLabel
}: ApiKeyManagerProps) => {
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null)

  const handleSave = async (apiKey: string) => {
    const value = editValues[apiKey] || ''
    if (!value.trim()) return

    setSaving(apiKey)
    try {
      await onSave(apiKey, value)
      setEditValues(prev => {
        const next = { ...prev }
        delete next[apiKey]
        return next
      })
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setSaving(apiKey)
      setTimeout(() => setSaving(null), 2000)
    }
  }

  const handleTest = async () => {
    if (!onTest) return
    
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTest(category)
      setTestResult(result)
    } catch (error) {
      setTestResult({ status: 'error', message: 'Test failed' })
    } finally {
      setTesting(false)
    }
  }

  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const filteredKeys = apiKeys.filter(k => k.category === category)

  if (filteredKeys.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft">
      <div className="px-6 py-4 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <KeyIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-900">{categoryLabel}</h3>
              <p className="text-sm text-stone-500 mt-0.5">
                {category === 'llm' && 'Configure Ollama connection'}
                {category === 'vector_db' && 'Configure Qdrant Cloud connection'}
                {category === 'embeddings' && 'Configure embedding service'}
              </p>
            </div>
          </div>
          {onTest && (
            <button
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          )}
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`
          mx-6 mt-4 p-4 rounded-lg border
          ${testResult.status === 'success' 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
          }
        `}>
          <div className="flex items-center gap-2">
            {testResult.status === 'success' ? (
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-red-600" />
            )}
            <p className={`text-sm font-medium ${
              testResult.status === 'success' ? 'text-green-900' : 'text-red-900'
            }`}>
              {testResult.message}
            </p>
          </div>
        </div>
      )}

      {/* API Keys */}
      <div className="p-6 space-y-4">
        {filteredKeys.map(apiKey => {
          const isEditing = editValues.hasOwnProperty(apiKey.key)
          const currentValue = editValues[apiKey.key] ?? apiKey.value
          const isVisible = visibleKeys.has(apiKey.key) || !apiKey.is_sensitive
          const hasChanges = editValues[apiKey.key] && editValues[apiKey.key] !== apiKey.value

          return (
            <div key={apiKey.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-1">
                    {apiKey.key}
                  </label>
                  {apiKey.description && (
                    <p className="text-xs text-stone-500">{apiKey.description}</p>
                  )}
                </div>
                {apiKey.is_sensitive && apiKey.value && (
                  <button
                    onClick={() => toggleVisibility(apiKey.key)}
                    className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                    type="button"
                  >
                    {visibleKeys.has(apiKey.key) ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type={isVisible && !apiKey.is_sensitive ? 'text' : 'password'}
                    value={isEditing ? currentValue : (isVisible ? currentValue : '••••••••')}
                    onChange={(e) => {
                      if (!isEditing) {
                        setEditValues(prev => ({ ...prev, [apiKey.key]: '' }))
                      }
                      setEditValues(prev => ({ ...prev, [apiKey.key]: e.target.value }))
                    }}
                    placeholder={apiKey.is_sensitive ? 'Enter new API key...' : 'Enter value...'}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-mono"
                  />
                  {!isVisible && apiKey.value && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="text-xs text-stone-400">Encrypted</span>
                    </div>
                  )}
                </div>
                {hasChanges && (
                  <button
                    onClick={() => handleSave(apiKey.key)}
                    disabled={saving === apiKey.key}
                    className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {saving === apiKey.key ? 'Saving...' : 'Save'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {category === 'embeddings' && (
        <div className="px-6 pb-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-800">
              ⚠️ <strong>Note:</strong> Embeddings service is used ONLY for vector generation, not for LLM reasoning.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
