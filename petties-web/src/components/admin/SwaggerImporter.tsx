import { useState } from 'react'
import { ArrowDownOnSquareIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline'
import { env } from '../../config/env'  // ✅ Sửa: relative path thay vì @/

interface SwaggerImporterProps {
  onImport: (url: string) => Promise<{ new_tools: number; updated_tools: number }>
  onScan?: () => Promise<{ total_tools: number }>
}

/**
 * Swagger/OpenAPI Importer Component
 * Allows admin to import tools from Spring Boot Swagger endpoint
 */
export const SwaggerImporter = ({ onImport, onScan }: SwaggerImporterProps) => {
  const [swaggerUrl, setSwaggerUrl] = useState(`${env.API_BASE_URL.replace('/api', '')}/v3/api-docs`)
  const [isImporting, setIsImporting] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<{ new_tools: number; updated_tools: number } | null>(null)

  const handleImport = async () => {
    if (!swaggerUrl.trim()) return
    
    setIsImporting(true)
    setResult(null)
    try {
      const res = await onImport(swaggerUrl)
      setResult(res)
    } catch (error) {
      console.error('Import failed:', error)
      alert('Failed to import from Swagger. Please check the URL and try again.')
    } finally {
      setIsImporting(false)
    }
  }

  const handleScan = async () => {
    if (!onScan) return
    
    setIsScanning(true)
    try {
      const res = await onScan()
      alert(`Scanned ${res.total_tools} code-based tools`)
    } catch (error) {
      console.error('Scan failed:', error)
      alert('Failed to scan code tools')
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-soft p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
          <ArrowDownOnSquareIcon className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Import Tools</h3>
          <p className="text-sm text-stone-500">
            Import tools from Swagger/OpenAPI or scan code-based tools
          </p>
        </div>
      </div>

      {/* Swagger Import */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Swagger/OpenAPI URL
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={swaggerUrl}
              onChange={(e) => setSwaggerUrl(e.target.value)}
              placeholder={`${env.API_BASE_URL.replace('/api', '')}/v3/api-docs`}
              className="flex-1 px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm"
            />
            <button
              onClick={handleImport}
              disabled={isImporting || !swaggerUrl.trim()}
              className="px-6 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              {isImporting ? 'Importing...' : 'Import Swagger'}
            </button>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            System will automatically parse endpoints and create MCP tools
          </p>
        </div>

        {/* Scan Code Tools */}
        {onScan && (
          <div className="pt-4 border-t border-stone-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-stone-900 mb-1">
                  Scan Code-based Tools
                </h4>
                <p className="text-xs text-stone-500">
                  Scan Python code for @mcp.tool decorators
                </p>
              </div>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <WrenchScrewdriverIcon className="w-4 h-4" />
                {isScanning ? 'Scanning...' : 'Scan Tools'}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-green-900">
                  Import successful!
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  {result.new_tools} new tools created, {result.updated_tools} tools updated
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
