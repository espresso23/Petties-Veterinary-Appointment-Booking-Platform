import { useState, useRef } from 'react'
import { ArrowUpOnSquareIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface DocumentUploadProps {
  onUpload: (file: File, notes?: string) => Promise<void>
  accept?: string
}

/**
 * Document Upload Component with Drag & Drop
 * Supports PDF, DOCX, TXT, MD files
 */
export const DocumentUpload = ({ onUpload, accept = '.pdf,.docx,.txt,.md' }: DocumentUploadProps) => {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file && isValidFile(file)) {
      setSelectedFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && isValidFile(file)) {
      setSelectedFile(file)
    }
  }

  const isValidFile = (file: File): boolean => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown']
    return validTypes.includes(file.type) ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md')
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      await onUpload(selectedFile, notes || undefined)
      setSelectedFile(null)
      setNotes('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  return (
    <div className="space-y-4">
      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-colors
          ${dragging
            ? 'border-amber-500 bg-amber-50'
            : 'border-stone-300 bg-stone-50 hover:border-stone-400'
          }
          ${selectedFile ? 'bg-white border-stone-200' : ''}
        `}
      >
        {!selectedFile ? (
          <>
            <ArrowUpOnSquareIcon className="w-12 h-12 text-stone-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-stone-700 mb-1">
              Drag & drop a document here, or click to browse
            </p>
            <p className="text-xs text-stone-500 mb-4">
              Supports PDF, DOCX, TXT, MD (Max 10MB)
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <ArrowUpOnSquareIcon className="w-4 h-4" />
              Select File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept={accept}
              aria-label="Select document file"
              className="hidden"
            />
          </>
        ) : (
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DocumentTextIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-stone-900">{selectedFile.name}</p>
              <p className="text-xs text-stone-500 mt-1">
                {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
              </p>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              aria-label="Remove selected file"
              className="p-1 text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Notes Input */}
      {selectedFile && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Notes (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Phác đồ điều trị 2026"
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm text-stone-900 bg-white"
          />
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      )}
    </div>
  )
}
