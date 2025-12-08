import { useState, useEffect } from 'react'
import { knowledgeApi } from '../../../services/agentService'
import type { Document, QueryResult } from '../../../services/agentService'
import { DocumentUpload } from '../../../components/admin/DocumentUpload'
import { DocumentCard } from '../../../components/admin/DocumentCard'
import { RAGQueryTester } from '../../../components/admin/RAGQueryTester'
import { ArrowPathIcon, CircleStackIcon, DocumentTextIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

/**
 * Knowledge Base Management Page
 * 
 * Features:
 * - Upload documents (PDF, DOCX, TXT, MD)
 * - View document list with processing status
 * - Test RAG retrieval queries
 * - View indexing statistics
 */
export const KnowledgePage = () => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

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

  const handleUpload = async (file: File, notes?: string) => {
    try {
      await knowledgeApi.uploadDocument(file, notes)
      await loadData()
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await knowledgeApi.deleteDocument(id)
      await loadData()
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete document')
    }
  }

  const handleQuery = async (query: string, topK?: number): Promise<QueryResult[]> => {
    return await knowledgeApi.query(query, topK)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-stone-600">Loading knowledge base...</p>
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
              <h1 className="text-2xl font-bold text-stone-900">Knowledge Base</h1>
              <p className="text-sm text-stone-500 mt-1">
                Manage documents for RAG (Retrieval-Augmented Generation). Upload PDF, DOCX, or text files.
              </p>
            </div>
            <button
              onClick={loadData}
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
        {/* Statistics Cards */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
              <div className="flex items-center gap-3 mb-2">
                <DocumentTextIcon className="w-5 h-5 text-blue-600" />
                <div className="text-2xl font-bold text-stone-900">{status.total_documents || 0}</div>
              </div>
              <div className="text-sm text-stone-500">Total Documents</div>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
                <div className="text-2xl font-bold text-green-600">{status.processed_documents || 0}</div>
              </div>
              <div className="text-sm text-stone-500">Processed</div>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
              <div className="flex items-center gap-3 mb-2">
                <CircleStackIcon className="w-5 h-5 text-amber-600" />
                <div className="text-2xl font-bold text-amber-600">{status.total_vectors || 0}</div>
              </div>
              <div className="text-sm text-stone-500">Total Vectors</div>
            </div>
            <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5">
              <div className="flex items-center gap-3 mb-2">
                <CircleStackIcon className="w-5 h-5 text-purple-600" />
                <div className="text-2xl font-bold text-purple-600">
                  {status.storage_size_bytes 
                    ? formatBytes(status.storage_size_bytes) 
                    : '-'}
                </div>
              </div>
              <div className="text-sm text-stone-500">Storage Used</div>
            </div>
          </div>
        )}

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload & Documents */}
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-6">
              <h2 className="text-lg font-semibold text-stone-900 mb-4">Upload Document</h2>
              <DocumentUpload onUpload={handleUpload} />
            </div>

            {/* Documents List */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-stone-900">Documents</h2>
                <span className="text-sm text-stone-500">
                  {documents.length} {documents.length === 1 ? 'document' : 'documents'}
                </span>
              </div>
              
              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <DocumentTextIcon className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                  <p className="text-sm text-stone-500">
                    No documents yet. Upload your first document to get started!
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