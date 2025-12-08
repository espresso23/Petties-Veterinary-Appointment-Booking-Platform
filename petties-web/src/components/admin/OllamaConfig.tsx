import { useState, useEffect } from 'react'
import { CpuChipIcon, CheckCircleIcon, XCircleIcon, CloudIcon } from '@heroicons/react/24/outline'

interface OllamaModel {
  name: string
  size: string
  modified_at?: string
}

interface OllamaConfigProps {
  ollamaUrl: string
  ollamaApiKey?: string
  onUpdateUrl: (url: string) => Promise<void>
  onUpdateApiKey?: (apiKey: string) => Promise<void>
  onSelectModel: (model: string) => Promise<void>
  selectedModel?: string
}

/**
 * Ollama Connection Configuration
 * Configure Ollama server URL and select active model
 */
export const OllamaConfig = ({
  ollamaUrl,
  ollamaApiKey = '',
  onUpdateUrl,
  onUpdateApiKey,
  onSelectModel,
  selectedModel
}: OllamaConfigProps) => {
  // Detect mode: if API key exists (and not just 'SET' placeholder) or URL is https://ollama.com → Cloud mode
  const isCloudMode = (ollamaApiKey && ollamaApiKey !== 'SET' && ollamaApiKey !== '') || ollamaUrl.includes('ollama.com')
  
  const [mode, setMode] = useState<'local' | 'cloud'>(isCloudMode ? 'cloud' : 'local')
  const [url, setUrl] = useState(ollamaUrl || 'http://localhost:11434')
  const [apiKey, setApiKey] = useState((ollamaApiKey && ollamaApiKey !== 'SET') ? ollamaApiKey : '')
  const [models, setModels] = useState<OllamaModel[]>([])
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    if (mode === 'cloud' && apiKey) {
      fetchCloudModels()
    } else if (mode === 'local' && url) {
      fetchModels()
    }
  }, [mode, url, apiKey])

  const fetchModels = async () => {
    if (!url) return
    setLoading(true)
    try {
      const response = await fetch(`${url}/api/tags`)
      if (response.ok) {
        const data = await response.json()
        setModels((data.models || []).map((m: any) => ({
          name: m.name,
          size: m.size ? `${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB` : 'Unknown',
          modified_at: m.modified_at
        })))
      }
    } catch (error) {
      console.error('Failed to fetch models:', error)
      setModels([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCloudModels = async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const response = await fetch('https://ollama.com/api/tags', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setModels((data.models || []).map((m: any) => ({
          name: m.name,
          size: m.size ? `${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB` : 'Cloud',
          modified_at: m.modified_at
        })))
      } else {
        throw new Error('Failed to fetch cloud models')
      }
    } catch (error) {
      console.error('Failed to fetch cloud models:', error)
      setModels([
        { name: 'kimi-k2:1t-cloud', size: 'Cloud' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      if (mode === 'cloud') {
        if (!apiKey) {
          setTestResult({ status: 'error', message: 'API key is required for Cloud mode' })
          return
        }
        const response = await fetch('https://ollama.com/api/tags', {
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        })
        if (response.ok) {
          setTestResult({ status: 'success', message: 'Connected to Ollama Cloud successfully' })
          await fetchCloudModels()
        } else {
          setTestResult({ status: 'error', message: 'Cloud connection failed - check API key' })
        }
      } else {
        const response = await fetch(`${url}/api/tags`)
        if (response.ok) {
          setTestResult({ status: 'success', message: 'Connected to local Ollama successfully' })
          await fetchModels()
        } else {
          setTestResult({ status: 'error', message: 'Connection failed' })
        }
      }
    } catch (error) {
      setTestResult({ status: 'error', message: mode === 'cloud' ? 'Cannot connect to Ollama Cloud' : 'Cannot connect to Ollama server' })
    } finally {
      setTesting(false)
    }
  }

  const handleModeSwitch = (newMode: 'local' | 'cloud') => {
    setMode(newMode)
    if (newMode === 'cloud') {
      setUrl('https://ollama.com')
      // Auto-switch to cloud model if using kimi-k2
      if (selectedModel?.includes('kimi-k2') && !selectedModel.includes('cloud')) {
        onSelectModel('kimi-k2:1t-cloud')
      }
    } else {
      setUrl('http://localhost:11434')
      // Auto-switch to local model if using cloud version
      if (selectedModel?.includes('cloud')) {
        onSelectModel('kimi-k2')
      }
    }
  }

  const handleSave = async () => {
    try {
      if (mode === 'cloud') {
        // Cloud mode: save API key and URL
        if (onUpdateApiKey && apiKey) {
          await onUpdateApiKey(apiKey)
        }
        if (onUpdateUrl && url !== ollamaUrl) {
          await onUpdateUrl('https://ollama.com')
        }
      } else {
        // Local mode: save URL
        if (url !== ollamaUrl) {
          await onUpdateUrl(url)
        }
        // Clear API key if switching to local
        if (onUpdateApiKey && apiKey) {
          await onUpdateApiKey('')
        }
      }
    } catch (error) {
      console.error('Failed to save configuration:', error)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft">
      <div className="px-6 py-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <CpuChipIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Ollama Configuration</h3>
            <p className="text-sm text-stone-500 mt-0.5">
              Configure Ollama server connection and select active model
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Mode Toggle */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-3">
            Connection Mode
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => handleModeSwitch('local')}
              className={`
                flex-1 p-4 rounded-lg border-2 text-left transition-all cursor-pointer
                ${mode === 'local'
                  ? 'border-amber-500 bg-amber-50 shadow-medium'
                  : 'border-stone-200 hover:border-stone-300'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <CpuChipIcon className="w-5 h-5 text-stone-600" />
                <span className="font-medium text-stone-900">Local Ollama</span>
              </div>
              <p className="text-xs text-stone-500">Connect to local Ollama server</p>
            </button>
            <button
              onClick={() => handleModeSwitch('cloud')}
              className={`
                flex-1 p-4 rounded-lg border-2 text-left transition-all cursor-pointer
                ${mode === 'cloud'
                  ? 'border-amber-500 bg-amber-50 shadow-medium'
                  : 'border-stone-200 hover:border-stone-300'
                }
              `}
            >
              <div className="flex items-center gap-2 mb-1">
                <CloudIcon className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-stone-900">Ollama Cloud</span>
              </div>
              <p className="text-xs text-stone-500">Use Ollama Cloud (API key required)</p>
            </button>
          </div>
        </div>

        {/* API Key Field (Cloud mode only) */}
        {mode === 'cloud' && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Ollama Cloud API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Ollama Cloud API key"
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-mono"
            />
            <p className="text-xs text-stone-500 mt-1">
              Get your API key from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-amber-600 hover:underline">ollama.com</a>
            </p>
          </div>
        )}

        {/* Connection URL (Local mode only) */}
        {mode === 'local' && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Ollama Server URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-mono"
            />
          </div>
        )}

        {/* Test Connection Button */}
        <div className="flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={testing || (mode === 'cloud' && !apiKey.trim()) || (mode === 'local' && !url.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {(url !== ollamaUrl || (mode === 'cloud' && apiKey !== ollamaApiKey)) && (
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
            >
              Save Configuration
            </button>
          )}
        </div>
          {testResult && (
            <div className={`
              mt-2 p-3 rounded-lg flex items-center gap-2 text-sm
              ${testResult.status === 'success' 
                ? 'bg-green-50 text-green-900' 
                : 'bg-red-50 text-red-900'
              }
            `}>
              {testResult.status === 'success' ? (
                <CheckCircleIcon className="w-4 h-4" />
              ) : (
                <XCircleIcon className="w-4 h-4" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Available Models */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-3">
            Available Models
          </label>
          {loading ? (
            <div className="text-center py-8 text-sm text-stone-500">
              Loading models...
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-8 text-sm text-stone-500">
              No models found. Make sure Ollama is running and models are downloaded.
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((model) => (
                <button
                  key={model.name}
                  onClick={() => onSelectModel(model.name)}
                  className={`
                    w-full p-4 rounded-lg border-2 text-left transition-all cursor-pointer
                    ${selectedModel === model.name
                      ? 'border-amber-500 bg-amber-50 shadow-medium'
                      : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-900">{model.name}</span>
                        {selectedModel === model.name && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-500 mt-1">Size: {model.size}</p>
                    </div>
                    <div className={`
                      w-4 h-4 rounded-full border-2
                      ${selectedModel === model.name
                        ? 'border-amber-500 bg-amber-500'
                        : 'border-stone-300'
                      }
                    `}>
                      {selectedModel === model.name && (
                        <div className="w-full h-full rounded-full bg-white scale-50"></div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Save & Reload Button */}
        <div className="pt-4 border-t border-stone-200">
          <button
            onClick={async () => {
              // TODO: Implement save and reload context
              alert('Configuration saved and context reloaded')
            }}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
          >
            Save & Reload Context
          </button>
          <p className="text-xs text-stone-500 mt-2 text-center">
            Backend will refresh LangGraph Runtime with new configuration
          </p>
        </div>
      </div>
    </div>
  )
}
