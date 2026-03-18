import { useState, useEffect, useCallback } from 'react'
import { Document as PdfDocument, Page, pdfjs } from 'react-pdf'
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
  ArrowDownTrayIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { knowledgeApi } from '../../services/agentService'
import type { Document } from '../../services/agentService'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DocumentPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  document: Document
}

type PreviewState = 'loading' | 'ready' | 'error'

/**
 * Document Preview Modal
 * - PDF: Full visual render with react-pdf (page navigation + zoom)
 * - TXT/MD: Text content display
 * - DOCX: Download prompt
 */
export const DocumentPreviewModal = ({ isOpen, onClose, document }: DocumentPreviewModalProps) => {
  const [previewState, setPreviewState] = useState<PreviewState>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  // PDF state
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)

  // Text state (TXT/MD)
  const [textContent, setTextContent] = useState('')

  const fileType = document.file_type?.toLowerCase() || document.filename.split('.').pop()?.toLowerCase() || ''
  const isPdf = fileType === 'pdf'
  const isText = fileType === 'txt' || fileType === 'md'
  const isDocx = fileType === 'docx'

  const loadDocument = useCallback(async () => {
    setPreviewState('loading')
    setErrorMessage('')

    try {
      if (isPdf) {
        const { blob } = await knowledgeApi.fetchDocumentBlob(document.id)
        const url = URL.createObjectURL(blob)
        setPdfBlobUrl(url)
        setCurrentPage(1)
        setPreviewState('ready')
      } else if (isText) {
        const text = await knowledgeApi.fetchDocumentText(document.id)
        setTextContent(text)
        setPreviewState('ready')
      } else if (isDocx) {
        // DOCX: show download option
        setPreviewState('ready')
      } else {
        setErrorMessage('Định dạng file không được hỗ trợ preview')
        setPreviewState('error')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tải tài liệu'
      setErrorMessage(msg)
      setPreviewState('error')
    }
  }, [document.id, isPdf, isText, isDocx])

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadDocument()
    }
    return () => {
      // Cleanup blob URL
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl)
        setPdfBlobUrl(null)
      }
    }
  }, [isOpen, loadDocument])

  const handleDownload = async () => {
    try {
      const { blob } = await knowledgeApi.fetchDocumentBlob(document.id)
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = document.filename
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // Silent fail for download
    }
  }

  const onDocumentLoadSuccess = ({ numPages: total }: { numPages: number }) => {
    setNumPages(total)
  }

  const goToPrevPage = () => setCurrentPage(p => Math.max(1, p - 1))
  const goToNextPage = () => setCurrentPage(p => Math.min(numPages, p + 1))
  const zoomIn = () => setScale(s => Math.min(3, s + 0.2))
  const zoomOut = () => setScale(s => Math.max(0.5, s - 0.2))

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[95vw] h-[90vh] bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-stone-900 bg-stone-50">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-1.5 border-2 border-stone-900 rounded-lg ${isPdf ? 'bg-red-100' : isText ? 'bg-stone-100' : 'bg-blue-100'}`}>
              <DocumentTextIcon className={`w-5 h-5 ${isPdf ? 'text-red-600' : isText ? 'text-stone-600' : 'text-blue-600'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-stone-900 truncate">{document.filename}</h3>
              <p className="text-xs text-stone-500 uppercase">{fileType.toUpperCase()} {isPdf && numPages > 0 ? `• ${numPages} trang` : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Download */}
            <button
              onClick={handleDownload}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              title="Tải xuống"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              title="Đóng"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isPdf && previewState === 'ready' && (
          <div className="flex items-center justify-center gap-4 px-4 py-2 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevPage}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-stone-700 min-w-[80px] text-center">
                {currentPage} / {numPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                className="p-1.5 rounded-lg hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="w-px h-5 bg-stone-300" />

            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                disabled={scale <= 0.5}
                className="p-1.5 rounded-lg hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <MagnifyingGlassMinusIcon className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-stone-700 min-w-[50px] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                disabled={scale >= 3}
                className="p-1.5 rounded-lg hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <MagnifyingGlassPlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-stone-100">
          {/* Loading State */}
          {previewState === 'loading' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <ArrowPathIcon className="w-10 h-10 animate-spin text-amber-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-stone-600">Đang tải tài liệu...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {previewState === 'error' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md p-6">
                <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-stone-900 mb-1">Không thể hiển thị tài liệu</p>
                <p className="text-xs text-stone-500 mb-4">{errorMessage}</p>
                <button
                  onClick={loadDocument}
                  className="px-4 py-2 text-sm font-bold text-white bg-amber-600 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all cursor-pointer"
                >
                  Thử lại
                </button>
              </div>
            </div>
          )}

          {/* PDF Preview */}
          {isPdf && previewState === 'ready' && pdfBlobUrl && (
            <div className="flex justify-center py-4">
              <PdfDocument
                file={pdfBlobUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center py-20">
                    <ArrowPathIcon className="w-8 h-8 animate-spin text-amber-600" />
                  </div>
                }
                error={
                  <div className="flex items-center justify-center py-20 text-red-500">
                    <p className="text-sm font-medium">Lỗi khi render PDF</p>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  className="shadow-lg"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </PdfDocument>
            </div>
          )}

          {/* Text Preview (TXT/MD) */}
          {isText && previewState === 'ready' && (
            <div className="p-6">
              <pre className="whitespace-pre-wrap font-mono text-sm text-stone-800 bg-white rounded-xl border-2 border-stone-200 p-6 leading-relaxed max-h-full overflow-auto">
                {textContent}
              </pre>
            </div>
          )}

          {/* DOCX - Download prompt */}
          {isDocx && previewState === 'ready' && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <DocumentTextIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                <p className="text-sm font-bold text-stone-900 mb-2">File DOCX không hỗ trợ preview trực tiếp</p>
                <p className="text-xs text-stone-500 mb-4">Bạn có thể tải xuống để xem trên máy tính</p>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all cursor-pointer"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Tải xuống
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
