import { useState, useEffect } from 'react'
import { ApiKeyManager } from '../../../components/admin/ApiKeyManager'
import { OllamaConfig } from '../../../components/admin/OllamaConfig'
import { ArrowPathIcon, LockClosedIcon } from '@heroicons/react/24/outline'

interface Setting {
  key: string
  value: string
  category: string
  is_sensitive: boolean
  description?: string
}

import { useAuthStore } from '../../../store/authStore'

// Direct AI Service URL (no gateway)
// Use centralized env config for consistency
import { env } from '../../../config/env'
const AI_SERVICE_URL = env.AGENT_SERVICE_URL
const getAuthHeaders = (): Record<string, string> => {
  const token = useAuthStore.getState().accessToken
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

/**
 * System Settings Page
 * 
 * Features:
 * - API Key Management (Qdrant, Tavily, etc.)
 * - Ollama Connection Configuration
 * - Model Selection
 * - Dynamic Secrets Management
 */
export const SettingsPage = () => {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
  const [ollamaApiKey, setOllamaApiKey] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('kimi-k2')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        
        // Extract Ollama URL if exists
        const ollamaUrlSetting = data.find((s: Setting) => s.key === 'OLLAMA_BASE_URL' || s.key === 'OLLAMA_URL')
        if (ollamaUrlSetting) {
          setOllamaUrl(ollamaUrlSetting.value || 'http://localhost:11434')
        }
        
        // Extract Ollama API key if exists
        const apiKeySetting = data.find((s: Setting) => s.key === 'OLLAMA_API_KEY')
        if (apiKeySetting) {
          // Value is masked if is_sensitive, we can't get real value
          // Just track if it's set (not empty and not masked)
          if (apiKeySetting.is_sensitive && apiKeySetting.value.includes('****')) {
            setOllamaApiKey('SET') // Indicates key exists but is masked
          } else if (apiKeySetting.value) {
            setOllamaApiKey(apiKeySetting.value)
          }
        }
        
        // Extract selected model if exists
        const modelSetting = data.find((s: Setting) => s.key === 'OLLAMA_MODEL')
        if (modelSetting) {
          setSelectedModel(modelSetting.value || 'kimi-k2')
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveKey = async (key: string, value: string) => {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ value })
      })
      if (!response.ok) throw new Error('Failed to save')
      await loadSettings()
    } catch (error) {
      console.error('Save failed:', error)
      throw error
    }
  }

  const handleTestConnection = async (category: string) => {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings/test-${category}`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
      const result = await response.json()
      return result
    } catch (error) {
      return { status: 'error', message: 'Test failed' }
    }
  }

  const handleUpdateOllamaUrl = async (url: string) => {
    await handleSaveKey('OLLAMA_BASE_URL', url)
    setOllamaUrl(url)
  }

  const handleUpdateOllamaApiKey = async (apiKey: string) => {
    await handleSaveKey('OLLAMA_API_KEY', apiKey)
    setOllamaApiKey(apiKey)
  }

  const handleSelectModel = async (model: string) => {
    await handleSaveKey('OLLAMA_MODEL', model)
    setSelectedModel(model)
  }

  const groupedSettings = {
    llm: settings.filter(s => s.category === 'llm'),
    vector_db: settings.filter(s => s.category === 'vector_db'),
    embeddings: settings.filter(s => s.category === 'embeddings'),
    search: settings.filter(s => s.category === 'search'),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-stone-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">System Settings</h1>
              <p className="text-sm text-stone-500 mt-1">
                Configure API keys, service connections, and AI models. All keys are encrypted and stored securely.
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <LockClosedIcon className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">Encrypted Storage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Ollama Configuration */}
        <OllamaConfig
          ollamaUrl={ollamaUrl}
          ollamaApiKey={ollamaApiKey}
          onUpdateUrl={handleUpdateOllamaUrl}
          onUpdateApiKey={handleUpdateOllamaApiKey}
          onSelectModel={handleSelectModel}
          selectedModel={selectedModel}
        />

        {/* LLM Settings (Ollama) */}
        {groupedSettings.llm.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.llm}
            onSave={handleSaveKey}
            onTest={() => handleTestConnection('ollama')}
            category="llm"
            categoryLabel="Local LLM (Ollama)"
          />
        )}

        {/* Vector Database (Qdrant) */}
        {groupedSettings.vector_db.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.vector_db}
            onSave={handleSaveKey}
            onTest={() => handleTestConnection('qdrant')}
            category="vector_db"
            categoryLabel="Vector Database (Qdrant Cloud)"
          />
        )}

        {/* Embeddings */}
        {groupedSettings.embeddings.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.embeddings}
            onSave={handleSaveKey}
            onTest={() => handleTestConnection('embeddings')}
            category="embeddings"
            categoryLabel="Embeddings Service"
          />
        )}

        {/* Search API (Tavily, etc.) */}
        {groupedSettings.search.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.search}
            onSave={handleSaveKey}
            category="search"
            categoryLabel="Web Search API"
          />
        )}

        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Security Information</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>All API keys are encrypted using AES-256 encryption before storage</li>
            <li>Keys are never displayed in plain text unless explicitly revealed</li>
            <li>Configuration changes take effect immediately without server restart</li>
            <li>Only users with Admin role can access this page</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage