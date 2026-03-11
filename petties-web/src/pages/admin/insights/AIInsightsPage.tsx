import { useState, useEffect, useCallback } from 'react'
import { feedbackApi, kgApi, caseMemoryApi } from '../../../services/agentService'
import type {
  FeedbackStatsResponse,
  KGStatsResponse,
  KGBuildResponse,
  CaseMemoryStatsResponse,
  CaseMemoryPruneResponse
} from '../../../services/agentService'
import {
  ArrowPathIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChartBarIcon,
  CircleStackIcon,
  CubeTransparentIcon,
  TrashIcon,
  ArrowPathRoundedSquareIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { useToast } from '../../../components/Toast'

/**
 * AI Insights Page - Neobrutalism Edition
 *
 * 3 sections:
 * 1. Feedback Dashboard - stats, by_type, by_category with period selector
 * 2. Knowledge Graph - stats + build trigger
 * 3. Case Memory - stats + prune trigger
 */
export const AIInsightsPage = () => {
  const { showToast } = useToast()

  // --- Period selector ---
  const [periodDays, setPeriodDays] = useState(30)

  // --- Section 1: Feedback ---
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStatsResponse | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(true)

  // --- Section 2: Knowledge Graph ---
  const [kgStats, setKgStats] = useState<KGStatsResponse | null>(null)
  const [kgLoading, setKgLoading] = useState(true)
  const [kgBuilding, setKgBuilding] = useState(false)
  const [kgBuildResult, setKgBuildResult] = useState<KGBuildResponse | null>(null)

  // --- Section 3: Case Memory ---
  const [caseStats, setCaseStats] = useState<CaseMemoryStatsResponse | null>(null)
  const [caseLoading, setCaseLoading] = useState(true)
  const [casePruning, setCasePruning] = useState(false)
  const [casePruneResult, setCasePruneResult] = useState<CaseMemoryPruneResponse | null>(null)
  const [pruneOlderThanDays, setPruneOlderThanDays] = useState(90)

  // --- Load Feedback Stats ---
  const loadFeedbackStats = useCallback(async () => {
    try {
      setFeedbackLoading(true)
      const data = await feedbackApi.getStats(periodDays)
      setFeedbackStats(data)
    } catch (err) {
      console.error('Failed to load feedback stats:', err)
      showToast('error', 'Không thể tải thống kê phản hồi')
    } finally {
      setFeedbackLoading(false)
    }
  }, [periodDays, showToast])

  // --- Load KG Stats ---
  const loadKGStats = useCallback(async () => {
    try {
      setKgLoading(true)
      const data = await kgApi.getStats()
      setKgStats(data)
    } catch (err) {
      console.error('Failed to load KG stats:', err)
    } finally {
      setKgLoading(false)
    }
  }, [])

  // --- Load Case Memory Stats ---
  const loadCaseStats = useCallback(async () => {
    try {
      setCaseLoading(true)
      const data = await caseMemoryApi.getStats()
      setCaseStats(data)
    } catch (err) {
      console.error('Failed to load case memory stats:', err)
    } finally {
      setCaseLoading(false)
    }
  }, [])

  // --- Initial load ---
  useEffect(() => {
    loadFeedbackStats()
  }, [loadFeedbackStats])

  useEffect(() => {
    loadKGStats()
    loadCaseStats()
  }, [loadKGStats, loadCaseStats])

  // --- Actions ---
  const handleBuildKG = async () => {
    try {
      setKgBuilding(true)
      setKgBuildResult(null)
      const result = await kgApi.build()
      setKgBuildResult(result)
      showToast('success', `Đã xây dựng Knowledge Graph: ${result.triplets_extracted} bộ ba`)
      await loadKGStats()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định'
      showToast('error', `Xây dựng KG thất bại: ${message}`)
    } finally {
      setKgBuilding(false)
    }
  }

  const handlePruneCaseMemory = async () => {
    try {
      setCasePruning(true)
      setCasePruneResult(null)
      const result = await caseMemoryApi.prune(pruneOlderThanDays)
      setCasePruneResult(result)
      showToast('success', `Đã dọn dẹp ${result.pruned_count} ca cũ`)
      await loadCaseStats()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định'
      showToast('error', `Dọn dẹp thất bại: ${message}`)
    } finally {
      setCasePruning(false)
    }
  }

  // --- Helpers ---
  const positiveRate = feedbackStats ? Math.round(feedbackStats.positive_rate * 100) : 0
  const thumbsUp = feedbackStats?.by_type?.thumbs_up ?? 0
  const thumbsDown = feedbackStats?.by_type?.thumbs_down ?? 0

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="bg-amber-400 border-b-4 border-black">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-black uppercase italic tracking-tighter">AI INSIGHTS</h1>
              <p className="text-sm font-bold text-black mt-1 uppercase">
                Feedback, Knowledge Graph & Case Memory
              </p>
            </div>
            <button
              onClick={() => {
                loadFeedbackStats()
                loadKGStats()
                loadCaseStats()
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black uppercase bg-white text-stone-900 border-4 border-black shadow-[4px_4px_0_#1c1917] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4" />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">

        {/* ============================================
           SECTION 1: FEEDBACK DASHBOARD
           ============================================ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight">Phản hồi người dùng</h2>
            {/* Period selector */}
            <div className="flex items-center gap-2">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setPeriodDays(days)}
                  className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-stone-900 rounded-lg transition-all cursor-pointer ${
                    periodDays === days
                      ? 'bg-amber-600 text-white shadow-[2px_2px_0_#1c1917]'
                      : 'bg-white text-stone-900 hover:bg-stone-100'
                  }`}
                >
                  {days} ngày
                </button>
              ))}
            </div>
          </div>

          {feedbackLoading ? (
            <LoadingCard label="Đang tải thống kê phản hồi..." />
          ) : feedbackStats?.error ? (
            <ErrorCard message={feedbackStats.error} />
          ) : (
            <>
              {/* Stat Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={<ChartBarIcon className="w-5 h-5 text-amber-600" />}
                  value={feedbackStats?.total ?? 0}
                  label="Tổng phản hồi"
                  bgColor="bg-amber-50"
                />
                <StatCard
                  icon={<CheckCircleIcon className="w-5 h-5 text-green-600" />}
                  value={`${positiveRate}%`}
                  label="Tỉ lệ tích cực"
                  bgColor="bg-green-50"
                  valueColor="text-green-600"
                />
                <StatCard
                  icon={<HandThumbUpIcon className="w-5 h-5 text-blue-600" />}
                  value={thumbsUp}
                  label="Hài lòng"
                  bgColor="bg-blue-50"
                  valueColor="text-blue-600"
                />
                <StatCard
                  icon={<HandThumbDownIcon className="w-5 h-5 text-red-500" />}
                  value={thumbsDown}
                  label="Chưa hài lòng"
                  bgColor="bg-red-50"
                  valueColor="text-red-500"
                />
              </div>

              {/* Breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Type */}
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6">
                  <h3 className="text-sm font-black uppercase text-stone-700 mb-4">Theo loại phản hồi</h3>
                  {feedbackStats?.by_type && Object.keys(feedbackStats.by_type).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(feedbackStats.by_type).map(([type, count]) => (
                        <BarRow
                          key={type}
                          label={feedbackTypeLabel(type)}
                          count={count}
                          total={feedbackStats.total}
                          color={type === 'thumbs_up' ? 'bg-green-500' : type === 'thumbs_down' ? 'bg-red-400' : 'bg-amber-500'}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="Chưa có dữ liệu phản hồi" />
                  )}
                </div>

                {/* By Category */}
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6">
                  <h3 className="text-sm font-black uppercase text-stone-700 mb-4">Theo danh mục</h3>
                  {feedbackStats?.by_category && Object.keys(feedbackStats.by_category).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(feedbackStats.by_category).map(([cat, count]) => (
                        <BarRow
                          key={cat}
                          label={categoryLabel(cat)}
                          count={count}
                          total={feedbackStats.total}
                          color={categoryColor(cat)}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState text="Chưa có dữ liệu danh mục" />
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        {/* ============================================
           SECTION 2: KNOWLEDGE GRAPH
           ============================================ */}
        <section>
          <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight mb-4">Knowledge Graph</h2>

          {kgLoading ? (
            <LoadingCard label="Đang tải thống kê Knowledge Graph..." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* KG Stats Cards */}
              <StatCard
                icon={<CubeTransparentIcon className="w-5 h-5 text-purple-600" />}
                value={kgStats?.total_triplets ?? 0}
                label="Tổng bộ ba"
                bgColor="bg-purple-50"
                valueColor="text-purple-600"
              />
              <StatCard
                icon={<CircleStackIcon className="w-5 h-5 text-indigo-600" />}
                value={kgStats?.unique_entities ?? 0}
                label="Thực thể duy nhất"
                bgColor="bg-indigo-50"
                valueColor="text-indigo-600"
              />
              <StatCard
                icon={<ArrowPathRoundedSquareIcon className="w-5 h-5 text-teal-600" />}
                value={kgStats?.relation_types?.length ?? 0}
                label="Loại quan hệ"
                bgColor="bg-teal-50"
                valueColor="text-teal-600"
              />

              {/* Build KG Card */}
              <div className="lg:col-span-3 bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase text-stone-700">Xây dựng Knowledge Graph</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Trích xuất bộ ba (subject-predicate-object) từ tất cả tài liệu đã xử lý
                    </p>
                  </div>
                  <button
                    onClick={handleBuildKG}
                    disabled={kgBuilding}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black uppercase bg-purple-600 text-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {kgBuilding ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Đang xây dựng...
                      </>
                    ) : (
                      <>
                        <CubeTransparentIcon className="w-4 h-4" />
                        Xây dựng KG
                      </>
                    )}
                  </button>
                </div>

                {/* Build result */}
                {kgBuildResult && (
                  <div className="mt-4 p-4 bg-green-50 border-2 border-green-600 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-bold text-green-800">{kgBuildResult.message}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-stone-700">
                      <div>
                        <span className="font-bold uppercase">Tài liệu xử lý:</span>{' '}
                        {kgBuildResult.documents_processed}
                      </div>
                      <div>
                        <span className="font-bold uppercase">Bộ ba trích xuất:</span>{' '}
                        {kgBuildResult.triplets_extracted}
                      </div>
                      <div>
                        <span className="font-bold uppercase">Tài liệu bỏ qua:</span>{' '}
                        {kgBuildResult.documents_skipped?.length ?? 0}
                      </div>
                      <div>
                        <span className="font-bold uppercase">Thời gian:</span>{' '}
                        {(kgBuildResult.processing_time_ms / 1000).toFixed(1)}s
                      </div>
                    </div>
                  </div>
                )}

                {/* Sample triplets */}
                {kgStats?.sample_triplets && kgStats.sample_triplets.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-black uppercase text-stone-500 mb-2">Bộ ba mẫu</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-2 border-stone-900 rounded-lg overflow-hidden">
                        <thead>
                          <tr className="bg-purple-50">
                            <th className="text-left px-3 py-2 text-xs font-black uppercase border-b-2 border-stone-900">Chủ thể</th>
                            <th className="text-left px-3 py-2 text-xs font-black uppercase border-b-2 border-stone-900">Quan hệ</th>
                            <th className="text-left px-3 py-2 text-xs font-black uppercase border-b-2 border-stone-900">Đối tượng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {kgStats.sample_triplets.map((t, i) => (
                            <tr key={i} className="border-b border-stone-200 last:border-b-0 hover:bg-stone-50">
                              <td className="px-3 py-2 font-medium">{t.subject}</td>
                              <td className="px-3 py-2 text-purple-700 font-bold">{t.predicate}</td>
                              <td className="px-3 py-2">{t.object}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ============================================
           SECTION 3: CASE MEMORY
           ============================================ */}
        <section>
          <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight mb-4">Case Memory</h2>

          {caseLoading ? (
            <LoadingCard label="Đang tải thống kê Case Memory..." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Case Stats */}
              <StatCard
                icon={<CircleStackIcon className="w-5 h-5 text-amber-600" />}
                value={caseStats?.total_cases ?? 0}
                label="Tổng số ca"
                bgColor="bg-amber-50"
                valueColor="text-amber-600"
              />
              <StatCard
                icon={<CheckCircleIcon className="w-5 h-5 text-green-600" />}
                value={caseStats?.collection_status ?? 'N/A'}
                label="Trạng thái collection"
                bgColor="bg-green-50"
                valueColor="text-green-600"
              />

              {/* Prune Card */}
              <div className="lg:col-span-2 bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase text-stone-700">Dọn dẹp Case Memory</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Xóa các ca cũ có feedback thấp để giữ chất lượng dữ liệu
                    </p>
                  </div>
                </div>

                <div className="flex items-end gap-4 mb-4">
                  <div className="flex-1 max-w-xs">
                    <label className="block text-xs font-black uppercase text-stone-600 mb-1">
                      Xóa ca cũ hơn (ngày)
                    </label>
                    <input
                      type="number"
                      value={pruneOlderThanDays}
                      onChange={(e) => setPruneOlderThanDays(Number(e.target.value))}
                      min={7}
                      max={365}
                      className="w-full px-3 py-2 border-2 border-stone-900 rounded-lg text-sm font-medium shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600"
                    />
                  </div>
                  <button
                    onClick={handlePruneCaseMemory}
                    disabled={casePruning}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black uppercase bg-red-500 text-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {casePruning ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Đang dọn dẹp...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="w-4 h-4" />
                        Dọn dẹp
                      </>
                    )}
                  </button>
                </div>

                {/* Prune result */}
                {casePruneResult && (
                  <div className="p-4 bg-green-50 border-2 border-green-600 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircleIcon className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-bold text-green-800">{casePruneResult.message}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-stone-700">
                      <div>
                        <span className="font-bold uppercase">Đã xóa:</span> {casePruneResult.pruned_count} ca
                      </div>
                      <div>
                        <span className="font-bold uppercase">Feedback thấp hơn:</span>{' '}
                        {casePruneResult.criteria.max_feedback_below}
                      </div>
                      <div>
                        <span className="font-bold uppercase">Cũ hơn:</span>{' '}
                        {casePruneResult.criteria.older_than_days} ngày
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ===== SUB-COMPONENTS =====

interface StatCardProps {
  icon: React.ReactNode
  value: string | number
  label: string
  bgColor?: string
  valueColor?: string
}

function StatCard({ icon, value, label, bgColor = 'bg-white', valueColor = 'text-stone-900' }: StatCardProps) {
  return (
    <div className={`${bgColor} border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-5`}>
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <div className={`text-2xl font-black ${valueColor}`}>{value}</div>
      </div>
      <div className="text-xs font-bold text-stone-500 uppercase">{label}</div>
    </div>
  )
}

interface BarRowProps {
  label: string
  count: number
  total: number
  color: string
}

function BarRow({ label, count, total, color }: BarRowProps) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-stone-700">{label}</span>
        <span className="text-sm font-black text-stone-900">{count}</span>
      </div>
      <div className="w-full h-3 bg-stone-200 rounded-lg border border-stone-300 overflow-hidden">
        <div
          className={`h-full ${color} rounded-lg transition-all duration-500`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
    </div>
  )
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-3" />
        <p className="text-sm font-bold text-stone-500 uppercase">{label}</p>
      </div>
    </div>
  )
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border-2 border-red-500 rounded-xl p-6 flex items-center gap-3">
      <ExclamationTriangleIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-bold text-red-800">{message}</p>
        <p className="text-xs text-red-600 mt-1">Vui lòng kiểm tra kết nối AI Service</p>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8 border-2 border-dashed border-stone-300 rounded-lg">
      <ClockIcon className="w-8 h-8 text-stone-300 mx-auto mb-2" />
      <p className="text-sm font-bold text-stone-400 uppercase">{text}</p>
    </div>
  )
}

// ===== LABEL HELPERS =====

function feedbackTypeLabel(type: string): string {
  const map: Record<string, string> = {
    thumbs_up: 'Hài lòng',
    thumbs_down: 'Chưa hài lòng',
    rating: 'Đánh giá sao',
    text_feedback: 'Góp ý văn bản',
  }
  return map[type] ?? type
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    medical: 'Y tế',
    booking: 'Đặt lịch',
    clinic_ops: 'Vận hành phòng khám',
    general: 'Chung',
  }
  return map[cat] ?? cat
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    medical: 'bg-teal-500',
    booking: 'bg-blue-500',
    clinic_ops: 'bg-amber-500',
    general: 'bg-stone-500',
  }
  return map[cat] ?? 'bg-stone-400'
}

export default AIInsightsPage
