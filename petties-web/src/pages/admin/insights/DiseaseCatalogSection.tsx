import { useState, useEffect, useCallback } from 'react'
import { diseaseCatalogApi } from '../../../services/agentService'
import {
  ChartBarIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { useToast } from '../../../components/Toast'

interface DiseaseCatalogStats {
  catalog: {
    total_diseases: number
    total_aliases: number
  }
}

interface DiseaseItem {
  canonical_code: string
  display_name_vi: string
  system: string
  subsystem: string
  aliases: string[]
  species: string[]
}

interface DiseaseCatalogSectionProps {
  className?: string
}

/**
 * Disease Catalog Monitoring Section
 * 
 * Displays:
 * - Catalog statistics (diseases, aliases)
 * - Disease list with filters
 * - Learning progress
 */
export const DiseaseCatalogSection = ({ className = '' }: DiseaseCatalogSectionProps) => {
  const { showToast } = useToast()
  
  const [stats, setStats] = useState<DiseaseCatalogStats | null>(null)
  const [allSystems, setAllSystems] = useState<string[]>([])
  const [diseases, setDiseases] = useState<DiseaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [expandedAliasCode, setExpandedAliasCode] = useState<string | null>(null)
  const [speciesFilter, setSpeciesFilter] = useState<string>('all')
  const [systemFilter, setSystemFilter] = useState<string>('all')
  const pageSize = 20

  const loadStats = useCallback(async () => {
    try {
      const data = await diseaseCatalogApi.getStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load disease catalog stats:', err)
      showToast('error', 'Không thể tải thống kê danh mục bệnh')
    }
  }, [showToast])

  const loadDiseases = useCallback(async () => {
    try {
      setLoading(true)
      const data = await diseaseCatalogApi.list({
        page,
        page_size: pageSize,
        species: speciesFilter !== 'all' ? speciesFilter : undefined,
        system: systemFilter !== 'all' ? systemFilter : undefined,
      })
      setDiseases(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to load disease catalog:', err)
      showToast('error', 'Không thể tải danh sách bệnh')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, speciesFilter, systemFilter, showToast])

  const loadSystems = useCallback(async () => {
    try {
      const data = await diseaseCatalogApi.list({
        page: 1,
        page_size: 200,
      })
      setAllSystems(Array.from(new Set((data.items || []).map((item) => item.system))).sort())
    } catch (err) {
      console.error('Failed to load systems for filter:', err)
    }
  }, [])

  useEffect(() => {
    loadStats()
    loadDiseases()
    loadSystems()
  }, [loadStats, loadDiseases, loadSystems])

  const handleRefresh = () => {
    loadStats()
    loadDiseases()
    loadSystems()
    showToast('success', 'Đã làm mới dữ liệu')
  }

  const speciesOptions = [
    { value: 'all', label: 'Tất cả' },
    { value: 'dog', label: 'Chó' },
    { value: 'cat', label: 'Mèo' },
  ]

  const systemOptions = [
    { value: 'all', label: 'Tất cả hệ' },
    ...allSystems.map((sys) => ({
      value: sys,
      label: sys,
    })),
  ]

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-4">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-xs font-bold uppercase text-stone-500">Tổng bệnh tự học</p>
              <p className="text-2xl font-black text-stone-900">
                {stats?.catalog.total_diseases || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-4">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="w-8 h-8 text-mint-600" />
            <div>
              <p className="text-xs font-bold uppercase text-stone-500">Tổng aliases tự học</p>
              <p className="text-2xl font-black text-stone-900">
                {stats?.catalog.total_aliases || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-4">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-xs font-bold uppercase text-stone-500">Hệ cơ quan</p>
                <p className="text-2xl font-black text-stone-900">
                {allSystems.length}
                </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-4">
        <div className="flex items-center gap-4 mb-4">
          <FunnelIcon className="w-5 h-5 text-stone-700" />
          <h3 className="text-lg font-bold text-stone-900">Bộ lọc</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
              Loài
            </label>
            <select
              value={speciesFilter}
              onChange={(e) => {
                setSpeciesFilter(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] bg-white"
            >
              {speciesOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-stone-500 mb-1">
              Hệ cơ quan
            </label>
            <select
              value={systemFilter}
              onChange={(e) => {
                setSystemFilter(e.target.value)
                setPage(1)
              }}
              className="w-full px-3 py-2 border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] bg-white"
            >
              {systemOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-stone-600 flex items-end">
            Bộ lọc áp dụng theo loài và hệ cơ quan.
          </div>
        </div>
      </div>

      {/* Disease List */}
      <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917]">
        <div className="p-4 border-b-2 border-stone-900 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-900">
            Danh sách bệnh ({total})
          </h3>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white font-bold uppercase rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:bg-amber-700"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-stone-500">
            Đang tải...
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-100 border-b-2 border-stone-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-stone-700">
                      Mã bệnh
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-stone-700">
                      Tên tiếng Việt
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-stone-700">
                      Hệ cơ quan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-stone-700">
                      Loài
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase text-stone-700">
                      Aliases
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {diseases.map((disease) => (
                    <tr
                      key={disease.canonical_code}
                      className="border-b border-stone-200 hover:bg-amber-50"
                    >
                      <td className="px-4 py-3 font-mono text-sm text-stone-900">
                        {disease.canonical_code}
                      </td>
                      <td className="px-4 py-3 font-bold text-stone-900">
                        {disease.display_name_vi}
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-700">
                        <div>{disease.system}</div>
                        <div className="text-xs text-stone-500">{disease.subsystem}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-1">
                          {disease.species.includes('dog') && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded">
                              Chó
                            </span>
                          )}
                          {disease.species.includes('cat') && (
                            <span className="px-2 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded">
                              Mèo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-600 max-w-md">
                        {disease.aliases.length === 0 ? (
                          <span className="text-stone-400">--</span>
                        ) : (
                          <div className="space-y-2">
                            {expandedAliasCode === disease.canonical_code ? (
                              <div className="flex flex-wrap gap-1.5">
                                {disease.aliases.map((alias) => (
                                  <span
                                    key={`${disease.canonical_code}-${alias}`}
                                    className="px-2 py-0.5 text-[10px] font-bold text-stone-700 bg-stone-100 border border-stone-300 rounded"
                                  >
                                    {alias}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="break-words">
                                {disease.aliases.slice(0, 3).join(', ')}
                                {disease.aliases.length > 3 && '...'}
                              </p>
                            )}

                            {disease.aliases.length > 3 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedAliasCode((prev) =>
                                    prev === disease.canonical_code ? null : disease.canonical_code,
                                  )
                                }}
                                className="px-2 py-1 text-[10px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
                              >
                                {expandedAliasCode === disease.canonical_code
                                  ? 'Thu gọn aliases'
                                  : `Xem đủ ${disease.aliases.length} aliases`}
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t-2 border-stone-900 flex items-center justify-between">
              <p className="text-sm text-stone-600">
                Trang {page} / {Math.ceil(total / pageSize)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border-2 border-stone-900 rounded-lg disabled:opacity-50"
                >
                  <ChevronLeftIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-3 py-1 border-2 border-stone-900 rounded-lg disabled:opacity-50"
                >
                  <ChevronRightIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
