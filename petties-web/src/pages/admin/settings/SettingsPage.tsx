import { useState, useEffect } from 'react'
import { ApiKeyManager } from '../../../components/admin/ApiKeyManager'
import { ArrowPathIcon, LockClosedIcon, BeakerIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

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
 * System Settings Page - Neobrutalism Edition
 */
export const SettingsPage = () => {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 5000)
  }

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings`, {
        headers: getAuthHeaders()
      })
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
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
      showAlert('success', `Cấu hình ${key} đã được cập nhật!`)
    } catch (error) {
      console.error('Save failed:', error)
      showAlert('error', 'Không thể lưu cấu hình. Vui lòng thử lại.')
      throw error
    }
  }

  const handleTestConnection = async (endpoint: string) => {
    try {
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings/${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
      const result = await response.json()
      return result
    } catch (_error) {
      return { status: 'error', message: 'Kết nối thất bại' }
    }
  }

  const handleSeedDatabase = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn reset toàn bộ cấu hình về mặc định?')) return

    try {
      setSeeding(true)
      const response = await fetch(`${AI_SERVICE_URL}/api/v1/settings/seed?force=true`, {
        method: 'POST',
        headers: getAuthHeaders()
      })
      if (response.ok) {
        showAlert('success', 'Đã khởi tạo dữ liệu mặc định thành công!')
        await loadSettings()
      } else {
        showAlert('error', 'Khởi tạo thất bại')
      }
    } catch (_error) {
      showAlert('error', 'Lỗi kết nối server')
    } finally {
      setSeeding(false)
    }
  }

  const groupedSettings = {
    llm: settings.filter(s => s.category === 'llm'),
    vector_db: settings.filter(s => s.category === 'vector_db'),
    rag: settings.filter(s => s.category === 'rag'),
    embeddings: settings.filter(s => s.category === 'embeddings'),
    general: settings.filter(s => s.category === 'general'),
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="p-8 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-pulse">
          <ArrowPathIcon className="w-12 h-12 animate-spin text-black mx-auto mb-4" />
          <p className="text-xl font-black uppercase italic tracking-tighter">ĐANG TẢI CẤU HÌNH...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl mx-auto">
      {/* Alert Component */}
      {alert && (
        <div className={`fixed top-6 right-6 z-50 p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3 min-w-[300px] animate-in slide-in-from-right duration-300 ${alert.type === 'success' ? 'bg-green-400' :
          alert.type === 'error' ? 'bg-red-400' : 'bg-blue-400'
          }`}>
          {alert.type === 'success' ? <CheckCircleIcon className="w-6 h-6" /> : <ExclamationTriangleIcon className="w-6 h-6" />}
          <span className="font-bold uppercase text-sm">{alert.message}</span>
          <button onClick={() => setAlert(null)} className="ml-auto font-black cursor-pointer">×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-yellow-400 border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-5xl font-black text-black uppercase italic tracking-tighter mb-2">SYSTEM SETTINGS</h1>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-black text-white font-bold text-xs uppercase tracking-widest">ENCRYPTED VAULT</div>
            <p className="text-sm font-bold text-black uppercase opacity-80">Quản lý API Keys và cấu hình AI Models</p>
          </div>
        </div>

        <button
          onClick={handleSeedDatabase}
          disabled={seeding}
          className="bg-black text-white px-6 py-4 border-4 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {seeding ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <BeakerIcon className="w-5 h-5" />}
          {seeding ? 'ĐANG KHỞI TẠO...' : 'RESET MẶC ĐỊNH'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Render empty state if no settings */}
        {settings.length === 0 && !loading && (
          <div className="bg-white border-4 border-black p-12 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
            <BeakerIcon className="w-16 h-16 mx-auto mb-6 opacity-20" />
            <h2 className="text-2xl font-black uppercase mb-4">CHƯA CÓ DỮ LIỆU CẤU HÌNH</h2>
            <p className="font-bold text-stone-600 mb-8 uppercase">Hệ thống chưa được khởi tạo. Vui lòng bấm RESET MẶC ĐỊNH để bắt đầu.</p>
            <button
              onClick={handleSeedDatabase}
              className="bg-purple-500 text-white px-8 py-4 border-4 border-black font-black uppercase shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[6px] hover:translate-y-[6px] transition-all cursor-pointer"
            >
              KHỞI TẠO NGAY
            </button>
          </div>
        )}

        {/* LLM Settings */}
        {groupedSettings.llm.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.llm}
            onSave={handleSaveKey}
            onTest={() => handleTestConnection('test-openrouter')}
            category="llm"
            categoryLabel="LLM Provider (OpenRouter/Ollama)"
          />
        )}

        {/* RAG Settings */}
        {groupedSettings.rag.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.rag}
            onSave={handleSaveKey}
            onTest={() => handleTestConnection('test-cohere')}
            category="rag"
            categoryLabel="RAG & Knowledge Base"
          />
        )}

        {/* Vector Database */}
        {groupedSettings.vector_db.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.vector_db}
            onSave={handleSaveKey}
            onTest={() => handleTestConnection('test-qdrant')}
            category="vector_db"
            categoryLabel="Vector DB (Qdrant Cloud)"
          />
        )}

        {/* Other Embeddings */}
        {groupedSettings.embeddings.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.embeddings}
            onSave={handleSaveKey}
            onTest={() => handleTestConnection('test-embeddings')}
            category="embeddings"
            categoryLabel="Additional Embeddings Providers"
          />
        )}

        {/* General Settings */}
        {groupedSettings.general.length > 0 && (
          <ApiKeyManager
            apiKeys={groupedSettings.general}
            onSave={handleSaveKey}
            category="general"
            categoryLabel="General System Config"
          />
        )}

        {/* Security Info Card */}
        <div className="bg-blue-400 border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-3 mb-4">
            <LockClosedIcon className="w-8 h-8 text-black" />
            <h3 className="text-2xl font-black uppercase italic tracking-tighter">SECURITY PROTOCOL</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/30 p-4 border-2 border-black font-bold uppercase text-sm">
              Tất cả API keys đều được mã hóa AES-256 trước khi lưu vào PostgreSQL.
            </div>
            <div className="bg-white/30 p-4 border-2 border-black font-bold uppercase text-sm">
              Dữ liệu nhạy cảm chỉ được hiển thị khi Admin thực hiện hành động UNMASK.
            </div>
            <div className="bg-white/30 p-4 border-2 border-black font-bold uppercase text-sm">
              Mọi thay đổi có hiệu lực ngay lập tức (Hot-Reload) mà không cần khởi động lại Server.
            </div>
            <div className="bg-white/30 p-4 border-2 border-black font-bold uppercase text-sm">
              Truy cập bị giới hạn nghiêm ngặt chỉ dành cho Platform Administrators.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage