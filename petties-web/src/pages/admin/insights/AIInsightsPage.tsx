import { useState, useEffect, useCallback } from 'react'
import { feedbackApi, caseMemoryApi } from '../../../services/agentService'
import type {
  FeedbackStatsResponse,
  FeedbackListResponse,
  FeedbackItem,
  FeedbackListParams,
  CaseMemoryStatsResponse,
  CaseMemoryItem,
  CaseMemoryDetailItem,
  CaseMemoryListParams,
} from '../../../services/agentService'
import { DiseaseCatalogSection } from './DiseaseCatalogSection'
import {
  ArrowPathIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  ChartBarIcon,
  CircleStackIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TableCellsIcon,
  XMarkIcon,
  EyeIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import { useToast } from '../../../components/Toast'
import { ConfirmModal } from '../../../components/ConfirmModal'

/**
 * AI Insights Page - Neobrutalism Edition
 *
 * 2 sections:
 * 1. Feedback Dashboard - focus vào chất lượng phản hồi
 * 2. Kho ca bệnh AI - stats + prune trigger
 */
export const AIInsightsPage = () => {
  const { showToast } = useToast()

  // --- Period selector ---
  const [periodDays, setPeriodDays] = useState(30)

  // --- Section 1: Feedback ---
  const [feedbackStats, setFeedbackStats] = useState<FeedbackStatsResponse | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(true)

  // --- Section 2: Case Memory ---
  const [caseStats, setCaseStats] = useState<CaseMemoryStatsResponse | null>(null)
  const [caseLoading, setCaseLoading] = useState(true)

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
  const [selectedCase, setSelectedCase] = useState<CaseMemoryDetailItem | null>(null)
  const [showCaseDetail, setShowCaseDetail] = useState(false)
  const [caseDetailLoading, setCaseDetailLoading] = useState(false)

  // --- Delete Confirmation ---
  const [deleteCaseId, setDeleteCaseId] = useState<string | null>(null)
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set())

  // --- Section 3: Feedback Detail List ---
  const [feedbackList, setFeedbackList] = useState<FeedbackListResponse | null>(null)
  const [feedbackListLoading, setFeedbackListLoading] = useState(false)
  const [feedbackListPage, setFeedbackListPage] = useState(1)
  const [feedbackListFilters, setFeedbackListFilters] = useState<FeedbackListParams>({
    page_size: 15,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showDetailSection, setShowDetailSection] = useState(false)

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

  const handleToggleCaseSelection = (caseId: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev)
      if (next.has(caseId)) {
        next.delete(caseId)
      } else {
        next.add(caseId)
      }
      return next
    })
  }

  const handleToggleSelectAllVisible = () => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev)
      const visibleIds = caseList.map((item) => item.case_id)
      const isAllSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id))
      if (isAllSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleBulkDeleteCases = async () => {
    const idsToDelete = Array.from(selectedCaseIds)
    if (idsToDelete.length === 0) return

    try {
      const results = await Promise.allSettled(idsToDelete.map((id) => caseMemoryApi.delete(id)))
      const successCount = results.filter((result) => result.status === 'fulfilled').length
      const failedCount = results.length - successCount

      if (successCount > 0) {
        showToast('success', `Đã xóa ${successCount} ca bệnh.`)
      }
      if (failedCount > 0) {
        showToast('warning', `${failedCount} ca bệnh xóa không thành công. Vui lòng thử lại.`)
      }

      setSelectedCaseIds(new Set())
      setShowBulkDeleteConfirm(false)
      await loadCaseList(caseListPage)
      await loadCaseStats()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định'
      showToast('error', `Xóa hàng loạt thất bại: ${message}`)
    }
  }

  const handleOpenCaseDetail = useCallback(async (item: CaseMemoryItem) => {
    try {
      setCaseDetailLoading(true)
      setShowCaseDetail(true)
      const data = await caseMemoryApi.get(item.case_id)
      setSelectedCase(data.case)
    } catch (err) {
      console.error('Failed to load case detail:', err)
      setShowCaseDetail(false)
      setSelectedCase(null)
      showToast('error', 'Không thể tải chi tiết case')
    } finally {
      setCaseDetailLoading(false)
    }
  }, [showToast])

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
    loadCaseStats()
    loadCaseList(1)
  }, [loadCaseStats, loadCaseList])

  // Load feedback list when detail section is opened or filters change
  useEffect(() => {
    if (showDetailSection) {
      loadFeedbackList(1)
    }
  }, [showDetailSection, loadFeedbackList])

  // --- Helpers ---
  const positiveRate = feedbackStats ? Math.round(feedbackStats.positive_rate * 100) : 0
  const thumbsUp = feedbackStats?.by_type?.thumbs_up ?? 0
  const thumbsDown = feedbackStats?.by_type?.thumbs_down ?? 0
  const positiveCount = thumbsUp + (feedbackStats?.by_type?.confirmed ?? 0) + (feedbackStats?.by_type?.vet_confirmed ?? 0)
  const negativeCount = thumbsDown + (feedbackStats?.by_type?.report ?? 0)

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="bg-amber-400 border-b-4 border-black">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-black uppercase italic tracking-tighter">AI INSIGHTS</h1>
              <p className="text-sm font-bold text-black mt-1 uppercase">
                Phản hồi & Kho ca bệnh AI
              </p>
            </div>
            <button
              onClick={() => {
                loadFeedbackStats()
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
      <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col gap-8">

        {/* ============================================
           SECTION 0: DISEASE CATALOG MONITORING
           (HIDDEN: confusing for users - hide on FE only)
           ============================================ */}
        {/* <section className="order-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight">
              Danh mục bệnh - Giám sát học tự động
            </h2>
          </div>
          <DiseaseCatalogSection />
        </section> */}

        {/* ============================================
           SECTION 1: FEEDBACK DASHBOARD
           ============================================ */}
        <section className="order-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight">Chất lượng phản hồi AI</h2>
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

              <div className="grid grid-cols-1 gap-6">
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-6">
                  <h3 className="text-sm font-black uppercase text-stone-700 mb-4">Tổng quan chất lượng</h3>
                  {feedbackStats?.total ? (
                    <div className="space-y-3">
                      <BarRow label="Tích cực" count={positiveCount} total={feedbackStats.total} color="bg-green-500" />
                      <BarRow label="Tiêu cực" count={negativeCount} total={feedbackStats.total} color="bg-red-400" />
                    </div>
                  ) : (
                    <EmptyState text="Chưa có dữ liệu phản hồi" />
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
                <div className="p-4 pr-14 sm:pr-16 border-b-2 border-stone-900 bg-stone-50">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 p-3 bg-amber-50 border-2 border-stone-900 rounded-lg">
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
                            <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Nội dung</th>
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
           SECTION 2: CASE MEMORY
           ============================================ */}
        <section className="order-2">
          <h2 className="text-2xl font-black text-stone-900 uppercase tracking-tight mb-4">Kho ca bệnh AI</h2>

          {caseLoading ? (
            <LoadingCard label="Đang tải thống kê kho ca bệnh AI..." />
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
            </div>
          )}
        </section>

        {/* ============================================
           SECTION 3b: CASE MEMORY LIST
           ============================================ */}
        <section className="order-2">
          <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] overflow-hidden">
            {/* Header + Filters */}
            <div className="p-4 border-b-2 border-stone-900 bg-stone-50">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black uppercase text-stone-700 flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4" />
                  Danh sách ca bệnh
                  {caseListTotal > 0 && (
                    <span className="text-xs font-bold text-stone-400 normal-case">
                      ({caseListTotal} kết quả)
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    disabled={selectedCaseIds.size === 0}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black uppercase border-2 border-stone-900 rounded-lg bg-red-100 text-red-700 shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    Xóa đã chọn ({selectedCaseIds.size})
                  </button>
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
              <div className="mb-3 flex flex-col gap-3 sm:flex-row">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={caseListSearch}
                    onChange={(e) => setCaseListSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadCaseList(1)}
                    placeholder="Tìm kiếm trong nội dung ca bệnh..."
                    className="w-full px-4 py-2 bg-white border-2 border-stone-900 rounded-lg shadow-[2px_2px_0_#1c1917] focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-stone-400 text-sm"
                  />
                </div>
                <button
                  onClick={() => loadCaseList(1)}
                  className="w-full sm:w-auto px-4 py-2 bg-amber-600 text-white font-black uppercase rounded-lg shadow-[3px_3px_0_#1c1917] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
                >
                  Tìm kiếm
                </button>
              </div>

              {selectedCaseIds.size > 0 && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-stone-900 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-bold text-stone-700">
                    Đã chọn <span className="font-black text-stone-900">{selectedCaseIds.size}</span> ca bệnh
                    {' '} (bao gồm các trang đã duyệt).
                  </p>
                  <button
                    onClick={() => setSelectedCaseIds(new Set())}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black uppercase border-2 border-stone-900 rounded-lg bg-white text-stone-700 shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                    Bỏ chọn tất cả
                  </button>
                </div>
              )}

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
                <LoadingCard label="Đang tải danh sách ca bệnh..." />
              </div>
            ) : caseList.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-100 border-b-2 border-stone-900">
                        <th className="text-center px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={caseList.length > 0 && caseList.every((item) => selectedCaseIds.has(item.case_id))}
                            onChange={handleToggleSelectAllVisible}
                            className="h-4 w-4 cursor-pointer accent-amber-600"
                            aria-label="Chọn tất cả ca bệnh đang hiển thị"
                          />
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Loài</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Chủ đề chính</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Chẩn đoán</th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase text-stone-600">Ngày khám</th>
                        <th className="text-center px-3 py-2.5 text-[10px] font-black uppercase text-stone-600 min-w-[96px]">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {caseList.map((item) => (
                        <CaseRow
                          key={item.case_id}
                          item={item}
                          selected={selectedCaseIds.has(item.case_id)}
                          onToggleSelect={() => handleToggleCaseSelection(item.case_id)}
                          onView={() => void handleOpenCaseDetail(item)}
                          onDelete={() => setDeleteCaseId(item.case_id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t-2 border-stone-900 bg-stone-50">
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
                  <EmptyState text="Chưa có ca bệnh nào" />
              </div>
            )}
          </div>
        </section>

        {/* Case Detail Modal */}
        {showCaseDetail && (
          <CaseDetailModal
            case={selectedCase}
            isLoading={caseDetailLoading}
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
          message="Bạn có chắc muốn xóa ca bệnh này? Hành động này không thể hoàn tác."
          confirmLabel="Xóa"
          cancelLabel="Hủy"
          onConfirm={handleDeleteCase}
          onCancel={() => setDeleteCaseId(null)}
          isDanger
        />
        <ConfirmModal
          isOpen={showBulkDeleteConfirm}
          title="Xác nhận xóa hàng loạt"
          message={`Bạn có chắc muốn xóa ${selectedCaseIds.size} ca bệnh đã chọn? Hành động này không thể hoàn tác.`}
          confirmLabel="Xóa tất cả đã chọn"
          cancelLabel="Hủy"
          onConfirm={handleBulkDeleteCases}
          onCancel={() => setShowBulkDeleteConfirm(false)}
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
        <td className="px-3 py-2.5 text-xs text-stone-700 max-w-[400px] truncate">
          {item.feedback_text || item.message_content || item.feedback_reason || '--'}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr className="bg-amber-50 border-b border-stone-200">
          <td colSpan={3} className="px-4 py-3">
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

function buildPrescriptionMeta(rx: {
  times_of_day?: string[]
  before_after_meal?: string
  frequency_note?: string
  duration_days?: number
  duration?: string | number
  instructions?: string
}): string {
  const parts: string[] = []
  if (rx.times_of_day?.length) parts.push(`Thời điểm: ${rx.times_of_day.join(', ')}`)
  if (rx.before_after_meal) parts.push(`Bữa ăn: ${rx.before_after_meal}`)
  if (rx.frequency_note) parts.push(`Ghi chú tần suất: ${rx.frequency_note}`)
  if (rx.duration_days !== undefined && rx.duration_days !== null) {
    parts.push(`Thời gian: ${rx.duration_days} ngày`)
  } else if (rx.duration !== undefined && rx.duration !== null && rx.duration !== '') {
    parts.push(`Thời gian: ${rx.duration}`)
  }
  if (rx.instructions) parts.push(`Hướng dẫn: ${rx.instructions}`)
  return parts.join(' | ') || '--'
}

function renderTextBlock(label: string, value?: string, extraClassName = '') {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase text-stone-500">{label}</label>
      <div className={`rounded-lg border-2 border-stone-200 bg-stone-50 p-3 whitespace-pre-wrap text-stone-700 ${extraClassName}`.trim()}>
        {value?.trim() || '--'}
      </div>
    </div>
  )
}

function formatCaseMemorySpeciesVi(species?: string | null): string {
  const s = (species || '').toLowerCase()
  if (s === 'dog') return 'Chó'
  if (s === 'cat') return 'Mèo'
  if (s === 'other') return 'Khác'
  return species?.trim() || '--'
}

function formatCaseMemorySexVi(raw?: string | null): string {
  if (!raw?.trim()) return '--'
  const u = raw.trim().toUpperCase()
  if (u === 'MALE' || u === 'ĐỰC' || u === 'DUC') return 'Đực'
  if (u === 'FEMALE' || u === 'CÁI' || u === 'CAI') return 'Cái'
  if (u === 'UNKNOWN') return 'Chưa rõ'
  return raw.trim()
}

function CaseMemoryPatientContextSection({ item }: { item: CaseMemoryDetailItem }) {
  const vitals =
    item.vitals && typeof item.vitals === 'object' && !Array.isArray(item.vitals)
      ? (item.vitals as Record<string, unknown>)
      : {}
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const weightKg = num(vitals.weight_kg)
  const tempC = num(vitals.temperature_c)
  const heartRate = num(vitals.heart_rate)
  const bcs = num(vitals.bcs)
  const symptoms = (item.symptoms || []).filter((s) => Boolean(s?.trim()))
  const physical = (item.physical_exam || []).filter((s) => Boolean(s?.trim()))

  const hasStructured =
    Boolean(item.breed?.trim()) ||
    item.age_months != null ||
    Boolean(item.sex?.trim()) ||
    Boolean(item.allergies?.trim()) ||
    symptoms.length > 0 ||
    physical.length > 0 ||
    weightKg != null ||
    tempC != null ||
    heartRate != null ||
    bcs != null ||
    Boolean(item.pet_id?.trim()) ||
    Boolean(item.emr_id?.trim()) ||
    Boolean(item.booking_id?.trim())

  if (!hasStructured) {
    return (
      <div className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/90 p-4">
        <p className="text-[10px] font-black uppercase text-stone-600 mb-1">Ngữ cảnh bệnh nhân</p>
        <p className="text-xs text-stone-600">
          Ca được tạo trước khi lưu đủ trường cấu trúc (giống, tuổi, sinh hiệu, dị ứng…). Xem phần nội dung đầy đủ
          bên dưới hoặc đồng bộ lại từ EMR đã xác nhận.
        </p>
      </div>
    )
  }

  const field = (label: string, value: string) => (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase text-teal-900/80">{label}</p>
      <p className="font-bold text-stone-900 break-words">{value}</p>
    </div>
  )

  return (
    <div className="rounded-xl border-2 border-stone-900 bg-teal-50/90 p-4 shadow-[4px_4px_0_#1c1917]">
      <h4 className="text-xs font-black uppercase tracking-wide text-stone-900 mb-3">Ngữ cảnh bệnh nhân</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs">
        {field('Loài', formatCaseMemorySpeciesVi(item.species))}
        {field('Giống', item.breed?.trim() || '--')}
        {field('Tuổi (tháng)', item.age_months != null ? String(item.age_months) : '--')}
        {field('Giới tính', formatCaseMemorySexVi(item.sex))}
        {field('Cân nặng lúc khám (kg)', weightKg != null ? String(weightKg) : '--')}
        {field('Nhiệt độ (°C)', tempC != null ? String(tempC) : '--')}
        {field('Mạch (nhịp/phút)', heartRate != null ? String(heartRate) : '--')}
        {field('BCS', bcs != null ? String(bcs) : '--')}
        {field('Dị ứng (hồ sơ)', item.allergies?.trim() || '--')}
        {field('Mã EMR', item.emr_id?.trim() || '--')}
        {field('Mã thú cưng', item.pet_id?.trim() || '--')}
        {field('Mã booking', item.booking_id?.trim() || '--')}
      </div>
      {symptoms.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-black uppercase text-teal-900/80 mb-1.5">Triệu chứng / tín hiệu (tách)</p>
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map((s) => (
              <span
                key={s}
                className="rounded-lg border-2 border-stone-900 bg-white px-2 py-0.5 text-[11px] font-semibold text-stone-800 shadow-[2px_2px_0_#1c1917]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {physical.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] font-black uppercase text-teal-900/80 mb-1.5">Khám lâm sàng (tách)</p>
          <div className="flex flex-wrap gap-1.5">
            {physical.map((s) => (
              <span
                key={s}
                className="rounded-lg border-2 border-stone-800 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-stone-800"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== CASE MEMORY COMPONENTS =====

interface CaseRowProps {
  item: CaseMemoryItem
  selected: boolean
  onToggleSelect: () => void
  onView: () => void
  onDelete: () => void
}

function CaseRow({ item, selected, onToggleSelect, onView, onDelete }: CaseRowProps) {
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
    <tr className="group border-b border-stone-200 hover:bg-amber-50 transition-colors">
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 cursor-pointer accent-amber-600"
          aria-label={`Chọn ca bệnh ${item.case_id}`}
        />
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-block px-2 py-0.5 text-[10px] font-black uppercase border-2 border-stone-900 rounded-lg ${speciesColor}`}>
          {speciesLabel}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs font-medium text-stone-700 max-w-[200px] truncate">
        {item.chief_complaint || '--'}
      </td>
      <td className="px-3 py-2.5 text-xs font-bold text-stone-900 max-w-[200px] truncate">
        {item.display_name_vi || item.final_diagnosis_text || '--'}
      </td>
      <td className="px-3 py-2.5 text-xs font-medium text-stone-600 whitespace-nowrap">
        {item.exam_at ? formatFeedbackDate(item.exam_at) : '--'}
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
            title="Xóa ca bệnh"
          >
            <TrashIcon className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </td>
    </tr>
  )
}

interface CaseDetailModalProps {
  case: CaseMemoryDetailItem | null
  isLoading: boolean
  onClose: () => void
}

function CaseDetailModal({ case: item, isLoading, onClose }: CaseDetailModalProps) {
  const imageUrls = (item?.clinical_image_urls || []).filter((url) => Boolean(url?.trim()))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white border-4 border-stone-900 rounded-xl shadow-[8px_8px_0_#1c1917] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-stone-900 bg-amber-50">
          <h3 className="text-lg font-black uppercase text-stone-900">Chi tiết ca bệnh</h3>
          <button
            onClick={onClose}
            className="p-1.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
              <LoadingCard label="Đang tải chi tiết ca bệnh..." />
            ) : !item ? (
              <EmptyState text="Không có dữ liệu ca bệnh" />
            ) : (
            <>
              <CaseMemoryPatientContextSection item={item} />

              <div>
                    <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Mã ca bệnh (Case Memory)</label>
                  <p className="font-mono text-xs text-stone-700">{item.case_id}</p>
                </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Chẩn đoán dùng cho AI</label>
                <p className="font-bold text-stone-900">{item.display_name_vi || item.final_diagnosis_text || '--'}</p>
                {item.canonical_code && (
                  <p className="mt-1 text-xs text-stone-500">Mã chuẩn: {item.canonical_code}</p>
                )}
              </div>

              {renderTextBlock('Nguồn triệu chứng chính dùng cho retrieval', item.chief_complaint)}
              {renderTextBlock('Ghi chú lâm sàng dùng cho retrieval', item.clinical_notes)}

              <div>
                <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Hình ảnh lâm sàng</label>
                {imageUrls.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {imageUrls.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border-2 border-stone-900 bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                        title="Mở ảnh ở tab mới"
                      >
                        <img
                          src={url}
                          alt="Hình ảnh lâm sàng"
                          className="h-24 w-full object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-stone-400">--</span>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Ngày khám dùng để đối chiếu</label>
                <p className="font-medium text-stone-700">{item.exam_at ? formatFeedbackDate(item.exam_at) : '--'}</p>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-stone-500 mb-1">Protocol pattern AI dùng</label>
                {item.protocol_pattern ? (
                  <div className="space-y-3 rounded-lg border-2 border-stone-200 bg-amber-50 p-4">
                    {item.protocol_pattern.soap_template
                      ? renderTextBlock('Mẫu đánh giá chuẩn hóa', item.protocol_pattern.soap_template.assessment)
                      : null}

                    <div>
                      <p className="mb-2 text-[10px] font-black uppercase text-stone-500">Đơn thuốc thường gặp AI học từ ca đã xác nhận</p>
                      {item.protocol_pattern.common_prescriptions && item.protocol_pattern.common_prescriptions.length > 0 ? (
                        <div className="space-y-2">
                          {item.protocol_pattern.common_prescriptions.map((rx, index) => (
                            <div key={`${rx.medicine_name || rx.medicine || 'pattern-rx'}-${index}`} className="rounded-lg border border-stone-200 bg-white p-3 text-xs text-stone-700">
                              <p className="font-black text-stone-900">{rx.medicine_name || rx.medicine || '--'}</p>
                              <p className="mt-1 whitespace-pre-wrap">{buildPrescriptionMeta(rx)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-stone-400">--</span>
                      )}
                    </div>

                    {item.protocol_pattern.common_tests?.some((test) => Boolean(test?.test?.trim())) && (
                      <div>
                        <p className="mb-2 text-[10px] font-black uppercase text-stone-500">Xét nghiệm thường gặp</p>
                        <div className="flex flex-wrap gap-2">
                          {item.protocol_pattern.common_tests
                            .filter((test) => Boolean(test?.test?.trim()))
                            .map((test, idx) => (
                              <span key={`${test.test || 'test'}-${idx}`} className="px-2 py-1 bg-white text-stone-700 rounded-lg text-xs border border-stone-200">
                                {test.result ? `${test.test}: ${test.result}` : test.test}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {item.protocol_pattern.common_recommendations?.some((recommendation) => Boolean(recommendation?.trim())) && (
                      <div>
                        <p className="mb-2 text-[10px] font-black uppercase text-stone-500">Khuyến nghị thường gặp</p>
                        <div className="flex flex-wrap gap-2">
                          {item.protocol_pattern.common_recommendations
                            .filter((recommendation) => Boolean(recommendation?.trim()))
                            .map((recommendation, idx) => (
                              <span key={`${recommendation}-${idx}`} className="px-2 py-1 bg-white text-stone-700 rounded-lg text-xs border border-stone-200">
                                {recommendation}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-stone-400">--</span>
                )}
              </div>

              {renderTextBlock('Nội dung đầy đủ', item.text_content, 'max-h-40 overflow-y-auto text-sm')}
            </>
          )}
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
          {isActive ? 'Hoạt động' : 'Không hoạt động'}
        </div>
      </div>
      <div className="text-xs font-bold text-stone-500 uppercase">Trạng thái kho dữ liệu</div>
    </div>
  )
}

export default AIInsightsPage
