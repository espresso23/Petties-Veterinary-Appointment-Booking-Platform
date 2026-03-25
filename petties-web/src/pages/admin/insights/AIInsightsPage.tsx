import { useState, useEffect, useCallback } from 'react'
import { feedbackApi, kgApi, caseMemoryApi } from '../../../services/agentService'
import type {
  FeedbackStatsResponse,
  FeedbackListResponse,
  FeedbackItem,
  FeedbackListParams,
  KGStatsResponse,
  KGBuildResponse,
  KGVisualizeResponse,
  KGQueryResultItem,
  CaseMemoryStatsResponse,
  CaseMemoryPruneResponse,
  CaseMemoryItem,
  CaseMemoryListParams,
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
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TableCellsIcon,
  XMarkIcon,
  ArrowsPointingOutIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { useToast } from '../../../components/Toast'
import { GraphVisualizer } from '../../../components/admin/GraphVisualizer'
import { ConfirmModal } from '../../../components/ConfirmModal'

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
  const [kgVisualizeData, setKgVisualizeData] = useState<KGVisualizeResponse | null>(null)
  const [showKgGraph, setShowKgGraph] = useState(false)

  // --- Section 3: Case Memory ---
  const [caseStats, setCaseStats] = useState<CaseMemoryStatsResponse | null>(null)
  const [caseLoading, setCaseLoading] = useState(true)
  const [casePruning, setCasePruning] = useState(false)
  const [casePruneResult, setCasePruneResult] = useState<CaseMemoryPruneResponse | null>(null)
  const [pruneOlderThanDays, setPruneOlderThanDays] = useState(90)

  // --- Section 3b: Case Memory List ---

  const [caseList, setCaseList] = useState<CaseMemoryItem[]>([])
  const [caseListLoading, setCaseListLoading] = useState(false)
  const [caseListPage, setCaseListPage] = useState(1)
  const [caseListTotal, setCaseListTotal] = useState(0)
  const [caseListFilters, setCaseListFilters] = useState<CaseMemoryListParams>({
    page_size: 15,
  })
  const [caseListSearch, setCaseListSearch] = useState('')
  const [showCaseFilters, setShowCaseFilters] = useState(false)

  // --- Case Detail Modal ---
  const [selectedCase, setSelectedCase] = useState<CaseMemoryItem | null>(null)
  const [showCaseDetail, setShowCaseDetail] = useState(false)

  // --- Delete Confirmation ---
  const [deleteCaseId, setDeleteCaseId] = useState<string | null>(null)

  // --- Section 4: Feedback Detail List ---
  const [feedbackList, setFeedbackList] = useState<FeedbackListResponse | null>(null)
  const [feedbackListLoading, setFeedbackListLoading] = useState(false)
  const [feedbackListPage, setFeedbackListPage] = useState(1)
  const [feedbackListFilters, setFeedbackListFilters] = useState<FeedbackListParams>({
    page_size: 15,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showDetailSection, setShowDetailSection] = useState(false)
  // Knowledge Graph Query
  const [kgSearchQuery, setKgSearchQuery] = useState('')
  const [kgSearchResults, setKgSearchResults] = useState<KGQueryResultItem[]>([])
  const [kgSearching, setKgSearching] = useState(false)

  const handleQueryKG = async () => {
    if (!kgSearchQuery.trim()) return
    setKgSearching(true)
    try {
      const res = await kgApi.queryKG({ query: kgSearchQuery })
      setKgSearchResults(res.results)
      if (res.results.length === 0) {
        showToast('info', 'Không tìm thấy thông tin liên quan trong Knowledge Graph')
      }
    } catch (error) {
      const err = error as Error
      showToast('error', err.message || 'Lỗi khi truy vấn Knowledge Graph')
    } finally {
      setKgSearching(false)
    }
  }

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

  // --- Load Case Memory List ---
  const loadCaseList = useCallback(async (page: number = 1) => {
    try {
      setCaseListLoading(true)
      const params: CaseMemoryListParams = {
        ...caseListFilters,
        page,
        page_size: caseListFilters.page_size || 15,
      }
      if (caseListSearch.trim()) {
        params.query = caseListSearch.trim()
      }
      const data = await caseMemoryApi.list(params)
      setCaseList(data.items)
      setCaseListTotal(data.total)
      setCaseListPage(page)
    } catch (err) {
      console.error('Failed to load case list:', err)
      showToast('error', 'Không thể tải danh sách cases')
    } finally {
      setCaseListLoading(false)
    }
  }, [caseListFilters, caseListSearch, showToast])

  // --- Handle Delete Case ---
  const handleDeleteCase = async () => {
    if (!deleteCaseId) return
    try {
      await caseMemoryApi.delete(deleteCaseId)
      showToast('success', 'Đã xóa case thành công')
      setDeleteCaseId(null)
      await loadCaseList(caseListPage)
      await loadCaseStats()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định'
      showToast('error', `Xóa thất bại: ${message}`)
    }
  }

  // --- Load Feedback Detail List ---
  const loadFeedbackList = useCallback(async (page: number = 1) => {
    try {
      setFeedbackListLoading(true)
      const data = await feedbackApi.list({
        ...feedbackListFilters,
        page,
      })
      setFeedbackList(data)
      setFeedbackListPage(page)
    } catch (err) {
      console.error('Failed to load feedback list:', err)
      showToast('error', 'Không thể tải danh sách phản hồi')
    } finally {
      setFeedbackListLoading(false)
    }
  }, [feedbackListFilters, showToast])

  // --- Initial load ---
  useEffect(() => {
    loadFeedbackStats()
  }, [loadFeedbackStats])

  useEffect(() => {
    loadKGStats()
    loadCaseStats()
    loadCaseList(1)
  }, [loadKGStats, loadCaseStats, loadCaseList])

  // Load feedback list when detail section is opened or filters change
  useEffect(() => {
    if (showDetailSection) {
      loadFeedbackList(1)
    }
  }, [showDetailSection, loadFeedbackList])

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

  const handleShowKgGraph = async () => {
    if (showKgGraph) {
      setShowKgGraph(false)
      return
    }
    try {
      const data = await kgApi.visualize()
      setKgVisualizeData(data)
      setShowKgGraph(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định'
      showToast('error', `Không thể tải graph: ${message}`)
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
                  className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-stone-900 rounded-lg transition-all cursor-pointer ${periodDays === days
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

          {/* Feedback Detail Toggle Button */}
          <div className="mt-6">
            <button
              onClick={() => setShowDetailSection(!showDetailSection)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black uppercase bg-white text-stone-900 border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all cursor-pointer"
            >
              <TableCellsIcon className="w-4 h-4" />
              {showDetailSection ? 'Ẩn chi tiết' : 'Xem chi tiết từng phản hồi'}
            </button>
          </div>

          {/* Feedback Detail List */}
          {showDetailSection && (
            <div className="mt-6">
              <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden">
                {/* Header + Filters */}
                <div className="p-4 border-b-2 border-stone-900 bg-stone-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-black uppercase text-stone-700 flex items-center gap-2">
                      <TableCellsIcon className="w-4 h-4" />
                      Chi tiết phản hồi
                      {feedbackList && (
                        <span className="text-xs font-bold text-stone-400 normal-case">
                          ({feedbackList.total} kết quả)
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black uppercase border-2 border-stone-900 rounded-lg transition-all cursor-pointer ${showFilters ? 'bg-amber-400 shadow-none' : 'bg-white shadow-[2px_2px_0_#1c1917]'
                          }`}
                      >
                        <FunnelIcon className="w-3.5 h-3.5" />
                        Bộ lọc
                      </button>
                      <button
                        onClick={() => loadFeedbackList(feedbackListPage)}
                        className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
                      >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${feedbackListLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Filter Bar */}
                  {showFilters && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-3 bg-amber-50 border-2 border-stone-900 rounded-lg">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Loại</label>
                        <select
                          value={feedbackListFilters.feedback_type || ''}
                          onChange={(e) => setFeedbackListFilters(prev => ({ ...prev, feedback_type: e.target.value || undefined }))}
                          className="w-full px-2 py-1.5 text-xs border-2 border-stone-900 rounded-lg bg-white font-bold shadow-[2px_2px_0_#1c1917] cursor-pointer"
                        >
                          <option value="">Tất cả</option>
                          <option value="thumbs_up">Hài lòng</option>
                          <option value="thumbs_down">Chưa hài lòng</option>
                          <option value="report">Báo cáo</option>
                          <option value="confirmed">Xác nhận</option>
                          <option value="vet_confirmed">Bác sĩ xác nhận</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Danh mục</label>
                        <select
                          value={feedbackListFilters.feedback_category || ''}
                          onChange={(e) => setFeedbackListFilters(prev => ({ ...prev, feedback_category: e.target.value || undefined }))}
                          className="w-full px-2 py-1.5 text-xs border-2 border-stone-900 rounded-lg bg-white font-bold shadow-[2px_2px_0_#1c1917] cursor-pointer"
                        >
                          <option value="">Tất cả</option>
                          <option value="medical">Y tế</option>
                          <option value="booking">Đặt lịch</option>
                          <option value="clinic_ops">Vận hành PK</option>
                          <option value="knowledge">Kiến thức</option>
                          <option value="general">Chung</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Vai trò</label>
                        <select
                          value={feedbackListFilters.user_role || ''}
                          onChange={(e) => setFeedbackListFilters(prev => ({ ...prev, user_role: e.target.value || undefined }))}
                          className="w-full px-2 py-1.5 text-xs border-2 border-stone-900 rounded-lg bg-white font-bold shadow-[2px_2px_0_#1c1917] cursor-pointer"
                        >
                          <option value="">Tất cả</option>
                          <option value="PET_OWNER">Chủ thú cưng</option>
                          <option value="STAFF">Nhân viên</option>
                          <option value="CLINIC_MANAGER">Quản lý PK</option>
                          <option value="CLINIC_OWNER">Chủ PK</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Từ ngày</label>
                        <input
                          type="date"
                          value={feedbackListFilters.date_from || ''}
                          onChange={(e) => setFeedbackListFilters(prev => ({ ...prev, date_from: e.target.value || undefined }))}
                          className="w-full px-2 py-1.5 text-xs border-2 border-stone-900 rounded-lg bg-white font-bold shadow-[2px_2px_0_#1c1917]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Đến ngày</label>
                        <input
                          type="date"
                          value={feedbackListFilters.date_to || ''}
                          onChange={(e) => setFeedbackListFilters(prev => ({ ...prev, date_to: e.target.value || undefined }))}
                          className="w-full px-2 py-1.5 text-xs border-2 border-stone-900 rounded-lg bg-white font-bold shadow-[2px_2px_0_#1c1917]"
                        />
                      </div>
                      <div className="col-span-full flex justify-end">
                        <button
                          onClick={() => {
                            setFeedbackListFilters({ page_size: 15 })
                            setShowFilters(false)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-black uppercase text-stone-500 hover:text-stone-900 cursor-pointer"
                        >
                          <XMarkIcon className="w-3.5 h-3.5" />
                          Xóa bộ lọc
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Table */}
                {feedbackListLoading ? (
                  <div className="p-8">
                    <LoadingCard label="Đang tải danh sách phản hồi..." />
                  </div>
                ) : feedbackList && feedbackList.items.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-stone-100 border-b-2 border-stone-900">
                            <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Thời gian</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Loại</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Danh mục</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Vai trò</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Tool</th>
                            <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Nội dung</th>
                            <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Trọng số</th>
                            <th className="text-center px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {feedbackList.items.map((item) => (
                            <FeedbackRow key={item.feedback_id} item={item} />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between px-4 py-3 border-t-2 border-stone-900 bg-stone-50">
                      <span className="text-xs font-bold text-stone-500">
                        Trang {feedbackList.page} / {Math.ceil(feedbackList.total / feedbackList.page_size) || 1}
                        {' '}({feedbackList.total} kết quả)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadFeedbackList(feedbackListPage - 1)}
                          disabled={feedbackListPage <= 1}
                          className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                          <ChevronLeftIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => loadFeedbackList(feedbackListPage + 1)}
                          disabled={feedbackListPage >= Math.ceil((feedbackList?.total ?? 0) / (feedbackList?.page_size ?? 15))}
                          className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                          <ChevronRightIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-8">
                    <EmptyState text="Chưa có phản hồi nào" />
                  </div>
                )}
              </div>
            </div>
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
                value={kgStats?.triplet_count ?? 0}
                label="Tổng bộ ba"
                bgColor="bg-purple-50"
                valueColor="text-purple-600"
              />
              <StatCard
                icon={<CircleStackIcon className="w-5 h-5 text-indigo-600" />}
                value={kgStats?.entity_count ?? 0}
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
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black uppercase text-stone-700">Xây dựng Knowledge Graph</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Trích xuất bộ ba (subject-predicate-object) từ tất cả tài liệu đã xử lý
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
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
                    <button
                      onClick={handleShowKgGraph}
                      disabled={!kgStats?.triplet_count}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black uppercase bg-teal-600 text-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ArrowsPointingOutIcon className="w-4 h-4" />
                      {showKgGraph ? 'Ẩn Graph' : 'Xem Graph'}
                    </button>
                  </div>
                </div>

                {/* Graph Visualization */}
                {showKgGraph && kgVisualizeData && (
                  <div className="mt-4">
                    <GraphVisualizer data={kgVisualizeData} width={700} height={450} />
                  </div>
                )}
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

                {/* KG Query Section */}
                <div className="mt-8 pt-8 border-t-2 border-stone-100">
                  <div className="flex items-center gap-2 mb-4">
                    <MagnifyingGlassIcon className="w-5 h-5 text-purple-600" />
                    <h4 className="text-sm font-black uppercase text-stone-700">Test Truy vấn Knowledge Graph</h4>
                  </div>

                  <div className="flex gap-3 mb-6">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={kgSearchQuery}
                        onChange={(e) => setKgSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQueryKG()}
                        placeholder="Nhập câu hỏi hoặc từ khóa thú y (vídụ: Triệu chứng bệnh dại)..."
                        className="w-full px-4 py-2 bg-stone-50 border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder:text-stone-400"
                      />
                    </div>
                    <button
                      onClick={handleQueryKG}
                      disabled={kgSearching || !kgSearchQuery.trim()}
                      className="px-6 py-2 bg-stone-900 text-white font-black uppercase rounded-lg shadow-[3px_3px_0_#d97706] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:opacity-50"
                    >
                      {kgSearching ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : 'Truy vấn'}
                    </button>
                  </div>

                  {kgSearchResults.length > 0 && (
                    <div className="space-y-4">
                      <div className="overflow-x-auto border-2 border-stone-900 rounded-xl overflow-hidden shadow-[4px_4px_0_#1c1917]">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-stone-50 border-b-2 border-stone-900">
                              <th className="px-4 py-3 text-left font-black uppercase text-xs text-stone-600">Thông tin liên quan tìm được</th>
                              <th className="px-4 py-3 text-right font-black uppercase text-xs text-stone-600 w-24">Độ khớp</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y border-stone-200">
                            {kgSearchResults.map((res, i) => (
                              <tr key={i} className="hover:bg-purple-50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-stone-900 mb-1">{res.object}</div>
                                  <div className="flex flex-wrap gap-2">
                                    {res.source_nodes?.map((node, ni) => (
                                      <span key={ni} className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded text-[10px] font-bold border border-stone-200">
                                        {node}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-purple-600">
                                  {(res.score || 1).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

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
                value={caseStats?.points_count ?? 0}
                label="Tổng số ca"
                bgColor="bg-amber-50"
                valueColor="text-amber-600"
              />
              <CollectionStatusBadge status={caseStats?.status} />

              {/* Prune Card */}
              <div className="lg:col-span-2 bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase text-stone-700">Dọn dẹp Case Memory</h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Xóa các ca cũ có lần xác nhận thấp để giữ chất lượng dữ liệu
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
                        <span className="font-bold uppercase">Ít xác nhận hơn:</span>{' '}
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

        {/* ============================================
           SECTION 3b: CASE MEMORY LIST
           ============================================ */}
        <section>
          <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden">
            {/* Header + Filters */}
            <div className="p-4 border-b-2 border-stone-900 bg-stone-50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black uppercase text-stone-700 flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4" />
                  Danh sách Cases
                  {caseListTotal > 0 && (
                    <span className="text-xs font-bold text-stone-400 normal-case">
                      ({caseListTotal} kết quả)
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCaseFilters(!showCaseFilters)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black uppercase border-2 border-stone-900 rounded-lg transition-all cursor-pointer ${showCaseFilters ? 'bg-amber-400 shadow-none' : 'bg-white shadow-[2px_2px_0_#1c1917]'
                      }`}
                  >
                    <FunnelIcon className="w-3.5 h-3.5" />
                    Bộ lọc
                  </button>
                  <button
                    onClick={() => loadCaseList(caseListPage)}
                    className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
                  >
                    <ArrowPathIcon className={`w-3.5 h-3.5 ${caseListLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="flex gap-3 mb-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={caseListSearch}
                    onChange={(e) => setCaseListSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadCaseList(1)}
                    placeholder="Tìm kiếm trong nội dung case..."
                    className="w-full px-4 py-2 bg-white border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-stone-400 text-sm"
                  />
                </div>
                <button
                  onClick={() => loadCaseList(1)}
                  className="px-4 py-2 bg-amber-600 text-white font-black uppercase rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
                >
                  Tìm kiếm
                </button>
              </div>

              {/* Filter Bar */}
              {showCaseFilters && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-amber-50 border-2 border-stone-900 rounded-lg">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Loài</label>
                    <select
                      value={caseListFilters.species || ''}
                      onChange={(e) => setCaseListFilters(prev => ({ ...prev, species: e.target.value || undefined }))}
                      className="w-full px-2 py-1.5 text-xs border-2 border-stone-900 rounded-lg bg-white font-bold shadow-[2px_2px_0_#1c1917] cursor-pointer"
                    >
                      <option value="">Tất cả</option>
                      <option value="dog">Chó</option>
                      <option value="cat">Mèo</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Từ khóa chẩn đoán</label>
                    <input
                      type="text"
                      value={caseListFilters.diagnosis || ''}
                      onChange={(e) => setCaseListFilters(prev => ({ ...prev, diagnosis: e.target.value || undefined }))}
                      placeholder="Ví dụ: viêm da"
                      className="w-full px-2 py-1.5 text-xs border-2 border-stone-900 rounded-lg bg-white font-bold shadow-[2px_2px_0_#1c1917]"
                    />
                  </div>
                  <div className="col-span-full flex justify-end">
                    <button
                      onClick={() => {
                        setCaseListFilters({ page_size: 15 })
                        setShowCaseFilters(false)
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-black uppercase text-stone-500 hover:text-stone-900 cursor-pointer"
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                      Xóa bộ lọc
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            {caseListLoading ? (
              <div className="p-8">
                <LoadingCard label="Đang tải danh sách cases..." />
              </div>
            ) : caseList.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-100 border-b-2 border-stone-900">
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Loài</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Chủ đề chính</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Chẩn đoán</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Triệu chứng</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Lần xác nhận</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Ngày tạo</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseList.map((item) => (
                        <CaseRow
                          key={item.case_id}
                          item={item}
                          onView={() => {
                            setSelectedCase(item)
                            setShowCaseDetail(true)
                          }}
                          onDelete={() => setDeleteCaseId(item.case_id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t-2 border-stone-900 bg-stone-50">
                  <span className="text-xs font-bold text-stone-500">
                    Trang {caseListPage} / {Math.ceil(caseListTotal / (caseListFilters.page_size || 15)) || 1}
                    ({caseListTotal} kết quả)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadCaseList(caseListPage - 1)}
                      disabled={caseListPage <= 1}
                      className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => loadCaseList(caseListPage + 1)}
                      disabled={caseListPage >= Math.ceil(caseListTotal / (caseListFilters.page_size || 15))}
                      className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <ChevronRightIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8">
                <EmptyState text="Chưa có case nào" />
              </div>
            )}
          </div>
        </section>

        {/* Case Detail Modal */}
        {showCaseDetail && selectedCase && (
          <CaseDetailModal
            case={selectedCase}
            onClose={() => {
              setShowCaseDetail(false)
              setSelectedCase(null)
            }}
          />
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={deleteCaseId !== null}
          title="Xác nhận xóa"
          message="Bạn có chắc muốn xóa case này? Hành động này không thể hoàn tác."
          confirmLabel="Xóa"
          cancelLabel="Hủy"
          onConfirm={handleDeleteCase}
          onCancel={() => setDeleteCaseId(null)}
          isDanger
        />
      </div>
    </div>
  )
}

// ===== SUB-COMPONENTS =====

function FeedbackRow({ item }: { item: FeedbackItem }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!(item.feedback_text || item.feedback_reason || item.message_content)

  return (
    <>
      <tr
        className={`border-b border-stone-200 hover:bg-stone-50 ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <td className="px-3 py-2.5 text-xs font-medium text-stone-600 whitespace-nowrap">
          {item.created_at ? formatFeedbackDate(item.created_at) : '--'}
        </td>
        <td className="px-3 py-2.5">
          <FeedbackTypeBadge type={item.feedback_type} />
        </td>
        <td className="px-3 py-2.5">
          <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase border-2 border-stone-900 rounded-lg ${categoryBadgeColor(item.feedback_category)}`}>
            {categoryLabel(item.feedback_category)}
          </span>
        </td>
        <td className="px-3 py-2.5 text-xs font-bold text-stone-700">
          {roleLabel(item.user_role)}
        </td>
        <td className="px-3 py-2.5 text-xs font-mono text-stone-600">
          {item.tool_used || '--'}
        </td>
        <td className="px-3 py-2.5 text-xs text-stone-700 max-w-[200px] truncate">
          {item.feedback_text || item.message_content || item.feedback_reason || '--'}
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className={`text-xs font-black ${item.weight >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {item.weight > 0 ? '+' : ''}{item.weight.toFixed(1)}
          </span>
        </td>
        <td className="px-3 py-2.5 text-center">
          <span className="inline-block px-2 py-0.5 text-[10px] font-black uppercase border-2 border-stone-900 rounded-lg bg-stone-100 text-stone-700">
            Lưu audit
          </span>
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr className="bg-amber-50 border-b border-stone-200">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {item.feedback_reason && (
                <div>
                  <span className="font-black uppercase text-stone-500">Lý do: </span>
                  <span className="font-bold text-stone-700">{feedbackReasonLabel(item.feedback_reason)}</span>
                </div>
              )}
              {item.feedback_text && (
                <div className="sm:col-span-2">
                  <span className="font-black uppercase text-stone-500">Nội dung góp ý: </span>
                  <span className="font-medium text-stone-700">{item.feedback_text}</span>
                </div>
              )}
              {item.message_content && (
                <div className="sm:col-span-2">
                  <span className="font-black uppercase text-stone-500">AI trả lời: </span>
                  <span className="font-medium text-stone-600 italic">{item.message_content}</span>
                </div>
              )}
              <div>
                <span className="font-black uppercase text-stone-500">User ID: </span>
                <span className="font-mono text-stone-600">{item.user_id || '--'}</span>
              </div>
              <div>
                <span className="font-black uppercase text-stone-500">Session ID: </span>
                <span className="font-mono text-stone-600">{item.session_id ? item.session_id.slice(0, 8) + '...' : '--'}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

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

function FeedbackTypeBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    thumbs_up: { bg: 'bg-green-100', text: 'text-green-700', label: 'Hài lòng' },
    thumbs_down: { bg: 'bg-red-100', text: 'text-red-700', label: 'Chưa hài lòng' },
    report: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Báo cáo' },
    confirmed: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Xác nhận' },
    vet_confirmed: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'BS xác nhận' },
  }
  const c = config[type] || { bg: 'bg-stone-100', text: 'text-stone-700', label: type }
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase border-2 border-stone-900 rounded-lg ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function feedbackTypeLabel(type: string): string {
  const map: Record<string, string> = {
    thumbs_up: 'Hài lòng',
    thumbs_down: 'Chưa hài lòng',
    report: 'Báo cáo',
    confirmed: 'Xác nhận',
    vet_confirmed: 'Bác sĩ xác nhận',
  }
  return map[type] ?? type
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    medical: 'Y tế',
    booking: 'Đặt lịch',
    clinic_ops: 'Vận hành PK',
    knowledge: 'Kiến thức',
    general: 'Chung',
  }
  return map[cat] ?? cat
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    medical: 'bg-teal-500',
    booking: 'bg-blue-500',
    clinic_ops: 'bg-amber-500',
    knowledge: 'bg-purple-500',
    general: 'bg-stone-500',
  }
  return map[cat] ?? 'bg-stone-400'
}

function categoryBadgeColor(cat: string): string {
  const map: Record<string, string> = {
    medical: 'bg-teal-100 text-teal-700',
    booking: 'bg-blue-100 text-blue-700',
    clinic_ops: 'bg-amber-100 text-amber-700',
    knowledge: 'bg-purple-100 text-purple-700',
    general: 'bg-stone-100 text-stone-700',
  }
  return map[cat] ?? 'bg-stone-100 text-stone-700'
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    PET_OWNER: 'Chủ thú cưng',
    STAFF: 'Nhân viên',
    CLINIC_MANAGER: 'Quản lý PK',
    CLINIC_OWNER: 'Chủ PK',
    ADMIN: 'Admin',
  }
  return map[role] ?? role
}

function feedbackReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    incorrect_info: 'Thông tin không chính xác',
    unhelpful: 'Không hữu ích',
    offensive: 'Nội dung phản cảm',
    wrong_tool: 'Dùng sai tool',
    slow_response: 'Phản hồi chậm',
    other: 'Lý do khác',
  }
  return map[reason] ?? reason
}

function formatFeedbackDate(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

// ===== CASE MEMORY COMPONENTS =====

interface CaseRowProps {
  item: CaseMemoryItem
  onView: () => void
  onDelete: () => void
}

function CaseRow({ item, onView, onDelete }: CaseRowProps) {
  const speciesLabel = {
    dog: 'Chó',
    cat: 'Mèo',
    other: 'Khác',
  }[item.species] || item.species

  const speciesColor = {
    dog: 'bg-amber-100 text-amber-700',
    cat: 'bg-purple-100 text-purple-700',
    other: 'bg-stone-100 text-stone-700',
  }[item.species] || 'bg-stone-100 text-stone-700'

  return (
    <tr className="border-b border-stone-200 hover:bg-amber-50 transition-colors">
      <td className="px-3 py-2.5">
        <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase border-2 border-stone-900 rounded-lg ${speciesColor}`}>
          {speciesLabel}
        </span>
        {item.breed && (
          <div className="text-[10px] text-stone-500 mt-0.5">{item.breed}</div>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs font-medium text-stone-700 max-w-[200px] truncate">
        {item.chief_complaint || '--'}
      </td>
      <td className="px-3 py-2.5 text-xs font-bold text-stone-900 max-w-[200px] truncate">
        {item.final_diagnosis_text || '--'}
      </td>
      <td className="px-3 py-2.5 text-xs text-stone-600 max-w-[150px]">
        <div className="flex flex-wrap gap-1">
          {item.symptoms?.slice(0, 2).map((s, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded text-[10px] border border-stone-200">
              {s}
            </span>
          ))}
          {item.symptoms && item.symptoms.length > 2 && (
            <span className="px-1.5 py-0.5 text-[10px] text-stone-400">
              +{item.symptoms.length - 2}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`inline-block px-2 py-0.5 text-xs font-black border-2 border-stone-900 rounded-lg ${item.confirmation_count > 0
          ? 'bg-green-100 text-green-700'
          : 'bg-stone-100 text-stone-500'
          }`}>
          {item.confirmation_count}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs font-medium text-stone-600 whitespace-nowrap">
        {item.created_at ? formatFeedbackDate(item.created_at) : '--'}
      </td>
      <td className="px-3 py-2.5 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={onView}
            className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
            title="Xem chi tiết"
          >
            <EyeIcon className="w-3.5 h-3.5 text-blue-600" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
            title="Xóa case"
          >
            <TrashIcon className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </td>
    </tr>
  )
}

interface CaseDetailModalProps {
  case: CaseMemoryItem
  onClose: () => void
}

function CaseDetailModal({ case: item, onClose }: CaseDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white border-4 border-stone-900 rounded-xl shadow-[8px_8px_0_#1c1917] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-stone-900 bg-amber-50">
          <h3 className="text-lg font-black uppercase text-stone-900">Chi tiết Case</h3>
          <button
            onClick={onClose}
            className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Pet Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Loài</label>
              <p className="font-bold text-stone-900 capitalize">{item.species}</p>
            </div>
            {item.breed && (
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Giống</label>
                <p className="font-bold text-stone-900">{item.breed}</p>
              </div>
            )}
          </div>

          {/* Chief Complaint */}
          <div>
            <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Chủ đề chính</label>
            <p className="font-medium text-stone-700">{item.chief_complaint || '--'}</p>
          </div>

          {/* Diagnosis */}
          <div>
            <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Chẩn đoán</label>
            <p className="font-bold text-stone-900">{item.final_diagnosis_text || '--'}</p>
            {item.canonical_code && (
              <p className="text-xs text-stone-500 mt-1">Mã: {item.canonical_code}</p>
            )}
          </div>

          {/* Symptoms */}
          <div>
            <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Triệu chứng</label>
            <div className="flex flex-wrap gap-2">
              {item.symptoms && item.symptoms.length > 0 ? (
                item.symptoms.map((s, i) => (
                  <span key={i} className="px-2 py-1 bg-stone-100 text-stone-700 rounded-lg text-sm border border-stone-200">
                    {s}
                  </span>
                ))
              ) : (
                <span className="text-stone-400">--</span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-stone-50 border-2 border-stone-300 rounded-lg">
              <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Lần xác nhận</label>
              <p className="text-xl font-black text-amber-600">{item.confirmation_count}</p>
            </div>
            <div className="p-3 bg-stone-50 border-2 border-stone-300 rounded-lg">
              <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Ngày tạo</label>
              <p className="text-sm font-bold text-stone-700">
                {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : '--'}
              </p>
            </div>
          </div>

          {/* Image URLs */}
          {item.image_urls && item.image_urls.length > 0 && (
            <div>
              <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Hình ảnh ({item.image_urls.length})</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.image_urls.map((url, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-xl border-2 border-stone-200 bg-stone-50"
                  >
                    <img
                      src={url}
                      alt={`Hình case ${i + 1}`}
                      className="h-40 w-full object-cover bg-white"
                      loading="lazy"
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-stone-200 px-3 py-2">
                      <span className="text-xs font-bold text-stone-700">Hình {i + 1}</span>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold uppercase text-blue-600 hover:text-blue-700"
                      >
                        Mở lớn
                      </a>
                    </div>
                    {item.image_descriptions?.[i]?.trim() && (
                      <div className="border-t border-stone-200 px-3 py-2">
                        <p className="text-xs leading-5 text-stone-600">
                          {item.image_descriptions[i]}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMR ID */}
          {item.emr_id && (
            <div>
              <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">EMR ID</label>
              <p className="text-xs font-mono text-stone-600">{item.emr_id}</p>
            </div>
          )}

          {/* Full Content */}
          <div>
            <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Nội dung đầy đủ</label>
            <div className="p-3 bg-stone-50 border-2 border-stone-200 rounded-lg text-sm text-stone-700 max-h-40 overflow-y-auto">
              {item.text_content || '--'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t-2 border-stone-900 bg-stone-50">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-black uppercase bg-stone-900 text-white border-2 border-stone-900 rounded-lg shadow-[3px_3px_0_#d97706] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== COLLECTION STATUS BADGE =====

interface CollectionStatusBadgeProps {
  status?: string
}

function CollectionStatusBadge({ status }: CollectionStatusBadgeProps) {
  const isActive = status === 'green' || status === 'GREEN'

  return (
    <div className={`border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-5 ${isActive ? 'bg-green-50' : 'bg-red-50'
      }`}>
      <div className="flex items-center gap-3 mb-2">
        {isActive ? (
          <span className="relative flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
          </span>
        ) : (
          <span className="relative flex h-4 w-4">
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
          </span>
        )}
        <div className={`text-2xl font-black ${isActive ? 'text-green-600' : 'text-red-500'}`}>
          {isActive ? 'ACTIVE' : 'INACTIVE'}
        </div>
      </div>
      <div className="text-xs font-bold text-stone-500 uppercase">Trạng thái collection</div>
    </div>
  )
}

export default AIInsightsPage
