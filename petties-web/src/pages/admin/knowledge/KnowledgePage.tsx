import { useState, useEffect } from 'react'
import { knowledgeApi } from '../../../services/agentService'
import type { Document, QueryResult } from '../../../services/agentService'
import { DocumentUpload } from '../../../components/admin/DocumentUpload'
import { DocumentCard } from '../../../components/admin/DocumentCard'
import { RAGQueryTester } from '../../../components/admin/RAGQueryTester'
import {
  ArrowPathIcon,
  CircleStackIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  KeyIcon,
  ServerIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { useToast } from '../../../components/Toast'
import { useAuthStore } from '../../../store/authStore'
import { env } from '../../../config/env'

const AI_SERVICE_URL = env.AGENT_SERVICE_URL

interface Setting {
  key: string
  value: string
  is_sensitive: boolean
}

/**
 * Knowledge Base Management Page - Neobrutalism Edition
 *
 * Features:
 * - Configure Cohere API for embeddings
 * - Configure Qdrant for vector storage
 * - Upload documents (PDF, DOCX, TXT, MD)
 * - View document list with processing status
 * - Test RAG retrieval queries
 */
export const KnowledgePage = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  // RAG Configuration state
  const [cohereApiKey, setCohereApiKey] = useState('')
  const [qdrantUrl, setQdrantUrl] = useState('')
  const [qdrantApiKey, setQdrantApiKey] = useState('')
  const [showCohereKey, setShowCohereKey] = useState(false)
  const [showQdrantKey, setShowQdrantKey] = useState(false)
  const [savingCohere, setSavingCohere] = useState(false)
  const [savingQdrant, setSavingQdrant] = useState(false)
  const [testingCohere, setTestingCohere] = useState(false)
  const [testingQdrant, setTestingQdrant] = useState(false)

  const getAuthHeaders = (): Record<string, string> => {
    const token = useAuthStore.getState().accessToken
    return token ? { 'Authorization': `Bearer ${token}` } : {}
  }

  useEffect(() => {
    loadData()
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const settings: Setting[] = await response.json()
        console.log('Knowledge Base Settings Loaded:', settings.length)

        const cohere = settings.find(s => s.key === 'COHERE_API_KEY')
        const qdrantUrlSetting = settings.find(s => s.key === 'QDRANT_URL')
        const qdrantKeySetting = settings.find(s => s.key === 'QDRANT_API_KEY')

        if (cohere?.value) setCohereApiKey(cohere.value)
        if (qdrantUrlSetting?.value) setQdrantUrl(qdrantUrlSetting.value)
        if (qdrantKeySetting?.value) setQdrantApiKey(qdrantKeySetting.value)
      } else {
        console.error('Failed to fetch settings:', response.status)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const [docs, stat] = await Promise.all([
        knowledgeApi.getDocuments(),
        knowledgeApi.getStatus()
      ])
      setDocuments(docs.documents)
      setStatus(stat)
    } catch (err) {
      console.error('Failed to load data', err)
    } finally {
      setLoading(false)
    }
  }

  const saveSetting = async (key: string, value: string) => {
    const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ value })
    })
    if (!response.ok) throw new Error('Failed to save setting')
  }

  const handleSaveCohere = async () => {
    try {
      setSavingCohere(true)
      await saveSetting('COHERE_API_KEY', cohereApiKey)
      showToast('success', 'Cohere API key saved successfully!')
    } catch (error) {
      showToast('error', 'Failed to save Cohere API key')
    } finally {
      setSavingCohere(false)
    }
  }

  const handleSaveQdrant = async () => {
    try {
      setSavingQdrant(true)
      await Promise.all([
        saveSetting('QDRANT_URL', qdrantUrl),
        saveSetting('QDRANT_API_KEY', qdrantApiKey)
      ])
      showToast('success', 'Qdrant configuration saved successfully!')
    } catch (error) {
      showToast('error', 'Failed to save Qdrant configuration')
    } finally {
      setSavingQdrant(false)
    }
  }

  const handleTestCohere = async () => {
    try {
      setTestingCohere(true)
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings/test-cohere`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
      const result = await response.json()
      if (result.status === 'success') {
        showToast('success', 'Cohere connection successful!')
      } else {
        showToast('error', result.message || 'Cohere connection failed')
      }
    } catch (error) {
      showToast('error', 'Failed to test Cohere connection')
    } finally {
      setTestingCohere(false)
    }
  }

  const handleTestQdrant = async () => {
    try {
      setTestingQdrant(true)
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings/test-qdrant`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
      const result = await response.json()
      if (result.status === 'success') {
        showToast('success', 'Qdrant connection successful!')
      } else {
        showToast('error', result.message || 'Qdrant connection failed')
      }
    } catch (error) {
      showToast('error', 'Failed to test Qdrant connection')
    } finally {
      setTestingQdrant(false)
    }
  }

  const handleUpload = async (file: File, notes?: string) => {
    try {
      await knowledgeApi.uploadDocument(file, notes)
      showToast('success', `Document "${file.name}" uploaded and processed!`)
      await loadData()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      showToast('error', `Upload failed: ${errorMessage}`)
      await loadData()
      throw error
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await knowledgeApi.deleteDocument(id)
      showToast('success', 'Document deleted')
      await loadData()
    } catch (error) {
      showToast('error', 'Failed to delete document')
    }
  }

  const handleQuery = async (query: string, topK?: number, minScore?: number): Promise<QueryResult[]> => {
    return await knowledgeApi.query(query, topK, minScore)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="p-8 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <ArrowPathIcon className="w-12 h-12 animate-spin text-black mx-auto mb-4" />
          <p className="text-xl font-black uppercase italic tracking-tighter">LOADING KNOWLEDGE BASE...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="bg-amber-400 border-b-4 border-black">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-black uppercase italic tracking-tighter">KNOWLEDGE BASE</h1>
              <p className="text-sm font-bold text-black mt-1 uppercase">
                RAG Configuration & Document Management
              </p>
            </div>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black uppercase bg-white text-stone-900 border-4 border-black shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* RAG Configuration Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cohere Embeddings Config */}
          <div className="bg-white border-4 border-black shadow-[8px_8px_0_#1c1917] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 border-2 border-black">
                <KeyIcon className="w-6 h-6 text-purple-700" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase">EMBEDDINGS (COHERE)</h2>
                <p className="text-xs text-stone-600 uppercase">embed-multilingual-v3.0</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-stone-700 mb-2">API KEY</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showCohereKey ? 'text' : 'password'}
                      value={cohereApiKey}
                      onChange={(e) => setCohereApiKey(e.target.value)}
                      placeholder="Enter Cohere API key"
                      className="w-full px-4 py-3 border-4 border-black font-mono text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCohereKey(!showCohereKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700 cursor-pointer"
                    >
                      {showCohereKey ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleTestCohere}
                  disabled={testingCohere || !cohereApiKey}
                  className="flex-1 px-4 py-2 bg-purple-100 border-4 border-black font-black uppercase text-sm text-stone-900 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {testingCohere ? (
                    <span className="flex items-center justify-center gap-2">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Testing...
                    </span>
                  ) : 'Test Connection'}
                </button>
                <button
                  onClick={handleSaveCohere}
                  disabled={savingCohere}
                  className="flex-1 px-4 py-2 bg-purple-500 text-white border-4 border-black font-black uppercase text-sm hover:bg-purple-600 disabled:opacity-50 shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all cursor-pointer"
                >
                  {savingCohere ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>

          {/* Qdrant Vector DB Config */}
          <div className="bg-white border-4 border-black shadow-[8px_8px_0_#1c1917] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 border-2 border-black">
                <ServerIcon className="w-6 h-6 text-blue-700" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase">VECTOR DATABASE (QDRANT)</h2>
                <p className="text-xs text-stone-600 uppercase">Qdrant Cloud or Self-hosted</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-stone-700 mb-2">URL</label>
                <input
                  type="text"
                  value={qdrantUrl}
                  onChange={(e) => setQdrantUrl(e.target.value)}
                  placeholder="https://xxx.qdrant.io:6333"
                  className="w-full px-4 py-3 border-4 border-black font-mono text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-stone-700 mb-2">API KEY</label>
                <div className="relative">
                  <input
                    type={showQdrantKey ? 'text' : 'password'}
                    value={qdrantApiKey}
                    onChange={(e) => setQdrantApiKey(e.target.value)}
                    placeholder="Enter Qdrant API key (optional for local)"
                    className="w-full px-4 py-3 border-4 border-black font-mono text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowQdrantKey(!showQdrantKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700 cursor-pointer"
                  >
                    {showQdrantKey ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleTestQdrant}
                  disabled={testingQdrant || !qdrantUrl}
                  className="flex-1 px-4 py-2 bg-blue-100 border-4 border-black font-black uppercase text-sm text-stone-900 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {testingQdrant ? (
                    <span className="flex items-center justify-center gap-2">
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Testing...
                    </span>
                  ) : 'Test Connection'}
                </button>
                <button
                  onClick={handleSaveQdrant}
                  disabled={savingQdrant}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white border-4 border-black font-black uppercase text-sm hover:bg-blue-600 disabled:opacity-50 shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all cursor-pointer"
                >
                  {savingQdrant ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Warning if not configured */}
        {(!cohereApiKey || !qdrantUrl) && (
          <div className="bg-yellow-100 border-4 border-black p-4 flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-800 flex-shrink-0" />
            <p className="font-black text-xs uppercase text-stone-900 tracking-tight">
              CẤU HÌNH COHERE API VÀ QDRANT URL TRÊN ĐỂ KÍCH HOẠT XỬ LÝ TÀI LIỆU VÀ TRUY VẤN RAG.
            </p>
          </div>
        )}

        {/* Statistics Cards */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border-4 border-black shadow-[4px_4px_0_#1c1917] p-5">
              <div className="flex items-center gap-3 mb-2">
                <DocumentTextIcon className="w-5 h-5 text-blue-600" />
                <div className="text-2xl font-black text-stone-900">{status.total_documents || 0}</div>
              </div>
              <div className="text-xs font-bold text-stone-500 uppercase">Total Documents</div>
            </div>
            <div className="bg-white border-4 border-black shadow-[4px_4px_0_#1c1917] p-5">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                <div className="text-2xl font-black text-green-600">{status.processed_documents || 0}</div>
              </div>
              <div className="text-xs font-bold text-stone-500 uppercase">Processed</div>
            </div>
            <div className="bg-white border-4 border-black shadow-[4px_4px_0_#1c1917] p-5">
              <div className="flex items-center gap-3 mb-2">
                <CircleStackIcon className="w-5 h-5 text-amber-600" />
                <div className="text-2xl font-black text-amber-600">{status.total_vectors || 0}</div>
              </div>
              <div className="text-xs font-bold text-stone-500 uppercase">Total Vectors</div>
            </div>
            <div className="bg-white border-4 border-black shadow-[4px_4px_0_#1c1917] p-5">
              <div className="flex items-center gap-3 mb-2">
                <CircleStackIcon className="w-5 h-5 text-purple-600" />
                <div className="text-2xl font-black text-purple-600">
                  {status.storage_size_bytes ? formatBytes(status.storage_size_bytes) : '-'}
                </div>
              </div>
              <div className="text-xs font-bold text-stone-500 uppercase">Storage Used</div>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload & Documents */}
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0_#1c1917] p-6">
              <h2 className="text-lg font-black uppercase mb-4">UPLOAD DOCUMENT</h2>
              <DocumentUpload onUpload={handleUpload} />
            </div>

            {/* Documents List */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0_#1c1917] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black uppercase">DOCUMENTS</h2>
                <span className="text-sm font-bold text-stone-500 uppercase">
                  {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                </span>
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-12 border-4 border-dashed border-stone-300">
                  <DocumentTextIcon className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <p className="font-bold text-stone-500 uppercase">
                    No documents yet. Upload your first document!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map(doc => (
                    <DocumentCard
                      key={doc.id}
                      document={doc}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Query Tester */}
          <div>
            <RAGQueryTester onQuery={handleQuery} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function
function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

export default KnowledgePage
