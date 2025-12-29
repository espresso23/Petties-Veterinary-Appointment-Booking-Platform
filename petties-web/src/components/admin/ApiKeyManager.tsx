import { useState } from 'react'
import { KeyIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon, ArrowPathIcon, BeakerIcon, LockClosedIcon } from '@heroicons/react/24/outline'

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
    <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col">
      <div className="px-6 py-4 border-b-4 border-black bg-stone-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 border-4 border-black bg-yellow-400 flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <KeyIcon className="w-8 h-8 text-black" />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-black">{categoryLabel}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black uppercase bg-black text-white px-2 py-0.5 tracking-widest">{category}</span>
              <p className="text-xs font-bold text-stone-600 uppercase">
                {category === 'llm' && 'Configure AI Model Providers'}
                {category === 'vector_db' && 'Vector Search Infrastructure'}
                {category === 'rag' && 'Knowledge Retrieval Settings'}
                {category === 'embeddings' && 'Text Embedding Models'}
                {category === 'general' && 'System Parameters'}
              </p>
            </div>
          </div>
        </div>
        {onTest && (
          <button
            onClick={handleTest}
            disabled={testing}
            className="bg-black text-white px-6 py-3 border-2 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {testing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <BeakerIcon className="w-4 h-4" />}
            {testing ? 'ĐANG KIỂM TRA...' : 'TEST CONNECTION'}
          </button>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`
          mx-6 mt-6 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
          ${testResult.status === 'success'
            ? 'bg-green-400'
            : 'bg-red-400'
          }
        `}>
          <div className="flex items-center gap-3">
            {testResult.status === 'success' ? (
              <CheckCircleIcon className="w-6 h-6 text-black" />
            ) : (
              <XCircleIcon className="w-6 h-6 text-black" />
            )}
            <p className="text-sm font-black uppercase tracking-tight">
              {testResult.message}
            </p>
          </div>
        </div>
      )}

      {/* API Keys */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {filteredKeys.map(apiKey => {
          const isEditing = Object.prototype.hasOwnProperty.call(editValues, apiKey.key)
          const isVisible = visibleKeys.has(apiKey.key) || !apiKey.is_sensitive
          const hasChanges = isEditing && editValues[apiKey.key] !== apiKey.value

          return (
            <div key={apiKey.key} className="space-y-2 group">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <label className="block text-xs font-black uppercase tracking-widest text-black">
                    {apiKey.key.replace(/_/g, ' ')}
                  </label>
                  {apiKey.is_sensitive && (
                    <span className="text-[9px] font-black px-1 bg-black text-white">SENSITIVE</span>
                  )}
                </div>
                {apiKey.is_sensitive && apiKey.value && (
                  <button
                    onClick={() => toggleVisibility(apiKey.key)}
                    className="p-1 hover:bg-stone-200 transition-colors cursor-pointer border border-transparent hover:border-black"
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

              <div className="flex gap-0 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform focus-within:-translate-x-1 focus-within:-translate-y-1">
                <div className="flex-1 relative bg-white">
                  <input
                    type={apiKey.is_sensitive && !isVisible ? 'password' : 'text'}
                    value={
                      isEditing
                        ? editValues[apiKey.key]
                        : (apiKey.is_sensitive && !isVisible
                          ? (apiKey.value ? '••••••••••••' : '')
                          : (apiKey.value || ''))
                    }
                    onChange={(e) => {
                      setEditValues(prev => ({ ...prev, [apiKey.key]: e.target.value }))
                    }}
                    placeholder={apiKey.is_sensitive ? 'Nhập API key...' : 'Nhập giá trị...'}
                    className="w-full px-4 py-3 outline-none text-sm font-black tracking-tight text-black bg-white"
                  />
                  {!isVisible && apiKey.value && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <LockClosedIcon className="w-4 h-4 opacity-30" />
                    </div>
                  )}
                </div>
                {hasChanges && (
                  <button
                    onClick={() => handleSave(apiKey.key)}
                    disabled={saving === apiKey.key}
                    className="px-6 py-3 bg-purple-500 text-white font-black uppercase text-xs border-l-4 border-black hover:bg-purple-600 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {saving === apiKey.key ? 'SAVING...' : 'UPDATE'}
                  </button>
                )}
              </div>
              {apiKey.description && (
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-tight">{apiKey.description}</p>
              )}
            </div>
          )
        })}
      </div>

      {category === 'rag' && (
        <div className="px-6 pb-6">
          <div className="p-4 bg-yellow-100 border-2 border-black font-bold text-xs uppercase text-black">
            <strong>MẸO:</strong> Đối với Tiếng Việt, hãy sử dụng Cohere Multilingual Embeddings để đạt hiệu quả cao nhất.
          </div>
        </div>
      )}
    </div>
  )
}
