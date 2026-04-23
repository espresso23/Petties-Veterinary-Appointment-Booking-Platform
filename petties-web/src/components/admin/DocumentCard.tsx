import { useState } from 'react'
import { TrashIcon, ClockIcon, CheckCircleIcon, EyeIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import type { Document } from '../../services/agentService'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { DocumentPreviewModal } from './DocumentPreviewModal'

interface DocumentCardProps {
  document: Document
  onDelete: (id: number) => Promise<void>
  onProcess?: (id: number) => Promise<void>
}

/**
 * Document Card Component
 * Shows document info, processing status, vector count, and preview button
 */
export const DocumentCard = ({ document, onDelete, onProcess }: DocumentCardProps) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [processing, setProcessing] = useState(false)

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getFileIcon = () => {
    const ext = document.filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'pdf':
        return (
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'docx':
        return (
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
          </div>
        )
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleConfirmDelete = async () => {
    setShowDeleteConfirm(false)
    await onDelete(document.id)
  }

  const handleProcess = async () => {
    if (!onProcess || processing) return
    setProcessing(true)
    try {
      await onProcess(document.id)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-5 hover:shadow-medium transition-shadow">
        <div className="flex items-start gap-4">
          {/* File Icon */}
          {getFileIcon()}

          {/* Document Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-stone-900 truncate mb-1">
              {document.filename}
            </h3>

            <div className="flex items-center gap-4 text-xs text-stone-500 mb-3">
              <span>{formatFileSize(document.file_size)}</span>
              <span>•</span>
              <span>{formatDate(document.uploaded_at)}</span>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2">
              {document.status === 'completed' || document.processed ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  Đã xử lý
                </span>
              ) : document.status === 'processing' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                  Đang xử lý...
                </span>
              ) : document.status === 'queued' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  <ClockIcon className="w-3.5 h-3.5" />
                  Đang chờ...
                </span>
              ) : document.status === 'failed' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  Lỗi xử lý
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  <ClockIcon className="w-3.5 h-3.5" />
                  Chờ xử lý
                </span>
              )}

              {(document.status === 'completed' || document.processed) && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {document.vector_count} text
                  </span>
                  {(document.image_count ?? 0) > 0 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      {document.image_count} images
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* Process Button - show if not completed and not currently active in queue */}
            {document.status !== 'completed' && !document.processed && (
              <button
                onClick={handleProcess}
                disabled={processing || document.status === 'queued' || document.status === 'processing'}
                className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title={document.status === 'failed' ? "Thử lại xử lý" : "Xử lý tài liệu"}
              >
                <ArrowPathIcon className={`w-5 h-5 ${processing || document.status === 'processing' ? 'animate-spin' : ''}`} />
              </button>
            )}

            {/* Preview Button */}
            <button
              onClick={() => setShowPreview(true)}
              className="p-2 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
              title="Xem nội dung"
            >
              <EyeIcon className="w-5 h-5" />
            </button>

            {/* Delete Button */}
            <button
              onClick={handleDeleteClick}
              className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              title="Xóa tài liệu"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <DocumentPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        document={document}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Xóa tài liệu"
        message={`Bạn có chắc muốn xóa "${document.filename}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa tài liệu"
        cancelText="Hủy bỏ"
        variant="danger"
      />
    </>
  )
}

