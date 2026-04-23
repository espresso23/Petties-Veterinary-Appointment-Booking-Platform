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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
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

    const files = Array.from(e.dataTransfer.files)
    const validFiles = files.filter(isValidFile)
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    const validFiles = files.filter(isValidFile)
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown'
    ]
    return validTypes.includes(file.type) ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md')
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    try {
      // Upload files one by one to avoid overwhelming the server
      for (const file of selectedFiles) {
        await onUpload(file, notes || undefined)
      }
      setSelectedFiles([])
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
          ${selectedFiles.length > 0 ? 'bg-white border-stone-200' : ''}
        `}
      >
        {selectedFiles.length === 0 ? (
          <>
            <ArrowUpOnSquareIcon className="w-12 h-12 text-stone-400 mx-auto mb-4" />
            <p className="text-sm font-medium text-stone-700 mb-1">
              Drag & drop documents here, or click to browse
            </p>
            <p className="text-xs text-stone-500 mb-4">
              Supports PDF, DOCX, TXT, MD (Max 10MB)
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <ArrowUpOnSquareIcon className="w-4 h-4" />
              Select Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              accept={accept}
              aria-label="Select document files"
              className="hidden"
            />
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-black uppercase text-stone-500 tracking-wider">
                Selected Documents ({selectedFiles.length})
              </h4>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
              >
                Add more...
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                accept={accept}
                className="hidden"
              />
            </div>
            
            <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center gap-3 bg-stone-50 p-2 rounded-lg border border-stone-200">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                    <DocumentTextIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-xs font-bold text-stone-900 truncate">{file.name}</p>
                    <p className="text-[10px] text-stone-500 uppercase">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    aria-label="Remove file"
                    className="p-1 text-stone-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Notes Input */}
      {selectedFiles.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Notes (Optional - applies to all selected)
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
      {selectedFiles.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {uploading ? `Uploading ${selectedFiles.length} files...` : `Upload ${selectedFiles.length} Documents`}
        </button>
      )}
    </div>
  )
}
