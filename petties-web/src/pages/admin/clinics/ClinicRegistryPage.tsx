import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clinicService } from '../../../services/api/clinicService'
import type { ClinicDeletionRequestResponse, ClinicResponse, ClinicStatus } from '../../../types/clinic'
import { useToast } from '../../../components/Toast'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { ArrowLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import '../../../styles/brutalist.css'

const STATUS_LABEL: Record<ClinicStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  SUSPENDED: 'Tạm ngưng',
}

function isPermanentStrike(d: string | null | undefined): boolean {
  return Boolean(d && d.startsWith('9999'))
}

function formatStrikeUntil(d: string | null | undefined): string {
  if (!d) return '—'
  if (isPermanentStrike(d)) return 'Vĩnh viễn'
  return new Date(d).toLocaleString('vi-VN')
}

export const ClinicRegistryPage = () => {
  const [clinics, setClinics] = useState<ClinicResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [filterStatus, setFilterStatus] = useState<ClinicStatus | 'ALL'>('ALL')
  const [nameQuery, setNameQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const { showToast } = useToast()

  const [banTarget, setBanTarget] = useState<ClinicResponse | null>(null)
  const [banReason, setBanReason] = useState('')
  const [liftTarget, setLiftTarget] = useState<ClinicResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [pendingDeletionRequests, setPendingDeletionRequests] = useState<ClinicDeletionRequestResponse[]>([])
  const [loadingDeletionRequests, setLoadingDeletionRequests] = useState(false)
  const [reviewingRequest, setReviewingRequest] = useState<ClinicDeletionRequestResponse | null>(null)
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [reviewNote, setReviewNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await clinicService.getAdminClinicRegistry({
        status: filterStatus === 'ALL' ? undefined : filterStatus,
        name: nameQuery.trim() || undefined,
        page,
        size: 15,
        sortBy: 'createdAt',
        sortDir: 'DESC',
      })
      setClinics(data.content ?? [])
      setTotalPages(data.totalPages ?? 0)
    } catch {
      showToast('error', 'Không thể tải danh sách phòng khám')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, nameQuery, page, showToast])

  const loadPendingDeletionRequests = useCallback(async () => {
    setLoadingDeletionRequests(true)
    try {
      const data = await clinicService.getPendingDeletionRequests(0, 20)
      setPendingDeletionRequests(data.content ?? [])
    } catch {
      showToast('error', 'Không thể tải danh sách đơn xóa phòng khám')
    } finally {
      setLoadingDeletionRequests(false)
    }
  }, [showToast])

  useEffect(() => {
    void load()
    void loadPendingDeletionRequests()
  }, [load, loadPendingDeletionRequests])

  const handleSearch = () => {
    setPage(0)
    setNameQuery(searchInput)
  }

  const handleBanConfirm = async () => {
    if (!banTarget || submitting) return
    const r = banReason.trim()
    if (r.length < 10) {
      showToast('error', 'Lý do phải ít nhất 10 ký tự')
      return
    }
    setSubmitting(true)
    try {
      await clinicService.adminBanClinic(banTarget.clinicId, r)
      showToast('success', 'Đã áp dụng hạn chế vĩnh viễn cho phòng khám')
      setBanTarget(null)
      setBanReason('')
      await load()
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      showToast('error', msg ? String(msg) : 'Không thể thực hiện hạn chế')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLiftConfirm = async () => {
    if (!liftTarget || submitting) return
    setSubmitting(true)
    try {
      await clinicService.adminLiftClinicStrike(liftTarget.clinicId)
      showToast('success', 'Đã gỡ hạn chế strike')
      setLiftTarget(null)
      await load()
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      showToast('error', msg ? String(msg) : 'Không thể gỡ hạn chế')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenReviewDeletionRequest = (request: ClinicDeletionRequestResponse, action: 'APPROVE' | 'REJECT') => {
    setReviewingRequest(request)
    setReviewAction(action)
    setReviewNote('')
  }

  const handleReviewDeletionRequest = async () => {
    if (!reviewingRequest || submitting) return
    if (reviewAction === 'REJECT' && reviewNote.trim().length === 0) {
      showToast('error', 'Vui lòng nhập lý do từ chối')
      return
    }

    setSubmitting(true)
    try {
      await clinicService.reviewDeletionRequest(
        reviewingRequest.requestId,
        reviewAction,
        reviewNote.trim() || undefined,
      )
      showToast('success', reviewAction === 'APPROVE' ? 'Đã duyệt đơn xóa phòng khám' : 'Đã từ chối đơn xóa phòng khám')
      setReviewingRequest(null)
      setReviewNote('')
      await load()
      await loadPendingDeletionRequests()
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      showToast('error', msg ? String(msg) : 'Không thể xử lý đơn xóa phòng khám')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      <div className="mb-6">
        <Link
          to="/admin/clinics"
          className="inline-flex items-center gap-2 text-sm font-bold uppercase text-stone-700 hover:text-amber-700 mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Về duyệt đăng ký
        </Link>
        <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">Phòng khám & chủ sở hữu</h1>
        <p className="text-stone-600 mt-1 max-w-2xl">
          Xem toàn bộ phòng khám, thông tin chủ sở hữu. Có thể hạn chế vĩnh viễn (không nhận lịch, không tìm kiếm) khi cần xử lý nghiêm.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Trạng thái</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setPage(0)
              setFilterStatus(e.target.value as ClinicStatus | 'ALL')
            }}
            className="border-2 border-stone-900 px-3 py-2 font-bold text-sm bg-white min-w-[160px]"
          >
            <option value="ALL">Tất cả</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
            <option value="SUSPENDED">Tạm ngưng</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px] max-w-md">
          <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Tên phòng khám</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Lọc theo tên..."
              className="flex-1 border-2 border-stone-900 px-3 py-2 font-medium"
            />
            <button
              type="button"
              onClick={handleSearch}
              className="px-4 py-2 font-bold uppercase text-sm bg-amber-400 border-2 border-stone-900 shadow-[3px_3px_0_#1c1917]"
            >
              Lọc
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
        <table className="w-full">
          <thead className="border-b-4 border-stone-900 bg-stone-100">
            <tr className="text-left font-bold uppercase text-xs tracking-wider">
              <th className="p-3">Phòng khám</th>
              <th className="p-3">Chủ sở hữu</th>
              <th className="p-3">Số điện thoại</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Hạn chế (strike)</th>
              <th className="p-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-600">
                  Đang tải...
                </td>
              </tr>
            ) : clinics.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-600">
                  Không có phòng khám nào
                </td>
              </tr>
            ) : (
              clinics.map((c) => {
                const hasStrike = Boolean(c.strikeUntil)
                const canBan = c.status === 'APPROVED' && !isPermanentStrike(c.strikeUntil ?? null)
                return (
                  <tr key={c.clinicId} className="border-b-2 border-stone-200 hover:bg-amber-50">
                    <td className="p-3">
                      <div className="font-bold">{c.name}</div>
                      <div className="text-[10px] text-stone-500 font-mono truncate max-w-[200px]">{c.clinicId}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold">{c.owner?.fullName || '—'}</div>
                      <div className="text-xs text-stone-600">{c.owner?.email || '—'}</div>
                    </td>
                    <td className="p-3 text-sm">{c.phone || '—'}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase border-2 border-stone-900 bg-stone-100">
                        {STATUS_LABEL[c.status]}
                      </span>
                    </td>
                    <td className="p-3 text-sm">{formatStrikeUntil(c.strikeUntil)}</td>
                    <td className="p-3 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {canBan && (
                          <button
                            type="button"
                            onClick={() => {
                              setBanTarget(c)
                              setBanReason('')
                            }}
                            className="px-2 py-1 text-[10px] font-bold uppercase bg-red-500 text-white border-2 border-stone-900"
                          >
                            Hạn chế vĩnh viễn
                          </button>
                        )}
                        {hasStrike && (
                          <button
                            type="button"
                            onClick={() => setLiftTarget(c)}
                            className="px-2 py-1 text-[10px] font-bold uppercase bg-mint-400 border-2 border-stone-900"
                          >
                            Gỡ hạn chế
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-4 py-2 font-bold uppercase border-2 border-stone-900 bg-white disabled:opacity-40"
          >
            Trước
          </button>
          <span className="px-4 py-2 font-bold text-stone-700">
            Trang {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="px-4 py-2 font-bold uppercase border-2 border-stone-900 bg-white disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}

      <div className="mt-8 bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
        <div className="p-4 border-b-4 border-stone-900 bg-stone-100">
          <h2 className="text-lg font-black uppercase">Đơn xóa phòng khám chờ duyệt</h2>
        </div>
        {loadingDeletionRequests ? (
          <div className="p-6 text-sm font-bold text-stone-600">Đang tải danh sách đơn xóa...</div>
        ) : pendingDeletionRequests.length === 0 ? (
          <div className="p-6 text-sm font-bold text-stone-600">Hiện không có đơn xóa nào đang chờ duyệt.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-4 border-stone-900 bg-stone-100">
                <tr className="text-left font-bold uppercase text-xs tracking-wider">
                  <th className="p-3">Phòng khám</th>
                  <th className="p-3">Chủ sở hữu</th>
                  <th className="p-3">Lý do</th>
                  <th className="p-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingDeletionRequests.map((request) => (
                  <tr key={request.requestId} className="border-b-2 border-stone-200 hover:bg-amber-50">
                    <td className="p-3">
                      <div className="font-bold">{request.clinicName || 'Phòng khám'}</div>
                      <div className="text-[10px] text-stone-500 font-mono">{request.clinicId}</div>
                    </td>
                    <td className="p-3 text-sm">{request.ownerName || '—'}</td>
                    <td className="p-3 text-sm max-w-[420px]">{request.reason}</td>
                    <td className="p-3">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenReviewDeletionRequest(request, 'APPROVE')}
                          className="px-3 py-1 text-xs font-bold uppercase bg-green-500 text-white border-2 border-stone-900"
                        >
                          Duyệt xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReviewDeletionRequest(request, 'REJECT')}
                          className="px-3 py-1 text-xs font-bold uppercase bg-red-500 text-white border-2 border-stone-900"
                        >
                          Từ chối
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {banTarget && (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-100 p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold uppercase">Hạn chế vĩnh viễn</h2>
              <button
                type="button"
                onClick={() => !submitting && setBanTarget(null)}
                className="p-1 border-2 border-stone-900"
                aria-label="Đóng"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-stone-700 mb-2">
              Phòng khám: <span className="font-bold">{banTarget.name}</span>
            </p>
            <p className="text-xs text-stone-500 mb-3">
              Phòng khám sẽ không nhận đặt lịch mới và không hiển thị trong tìm kiếm (giống strike vĩnh viễn).
            </p>
            <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Lý do (tối thiểu 10 ký tự)</label>
            <textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={4}
              className="w-full border-4 border-stone-900 p-3 font-medium text-sm mb-4"
              placeholder="Mô tả lý do hạn chế..."
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setBanTarget(null)}
                className="px-4 py-2 font-bold uppercase border-2 border-stone-900 bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting || banReason.trim().length < 10}
                onClick={() => void handleBanConfirm()}
                className="px-4 py-2 font-bold uppercase bg-red-500 text-white border-2 border-stone-900 disabled:opacity-50"
              >
                {submitting ? 'Đang xử lý...' : 'Xác nhận hạn chế'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={liftTarget !== null}
        title="Gỡ hạn chế strike"
        message={
          liftTarget
            ? `Gỡ hạn chế đặt lịch/tìm kiếm cho phòng khám "${liftTarget.name}"?`
            : ''
        }
        confirmLabel="Gỡ hạn chế"
        cancelLabel="Hủy"
        onConfirm={() => void handleLiftConfirm()}
        onCancel={() => !submitting && setLiftTarget(null)}
        isDanger={false}
      />

      {reviewingRequest && (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center z-100 p-4 backdrop-blur-sm">
          <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-bold uppercase">
                {reviewAction === 'APPROVE' ? 'Duyệt đơn xóa phòng khám' : 'Từ chối đơn xóa phòng khám'}
              </h2>
              <button
                type="button"
                onClick={() => !submitting && setReviewingRequest(null)}
                className="p-1 border-2 border-stone-900"
                aria-label="Đóng"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-stone-700 mb-2">
              Phòng khám: <span className="font-bold">{reviewingRequest.clinicName || reviewingRequest.clinicId}</span>
            </p>
            <p className="text-sm text-stone-700 mb-3">
              Lý do: {reviewingRequest.reason}
            </p>
            <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
              {reviewAction === 'APPROVE' ? 'Ghi chú (không bắt buộc)' : 'Lý do từ chối (bắt buộc)'}
            </label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={4}
              className="w-full border-4 border-stone-900 p-3 font-medium text-sm mb-4"
              placeholder={reviewAction === 'APPROVE' ? 'Nhập ghi chú nếu cần...' : 'Nhập lý do từ chối...'}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReviewingRequest(null)}
                className="px-4 py-2 font-bold uppercase border-2 border-stone-900 bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting || (reviewAction === 'REJECT' && reviewNote.trim().length === 0)}
                onClick={() => void handleReviewDeletionRequest()}
                className={`px-4 py-2 font-bold uppercase text-white border-2 border-stone-900 disabled:opacity-50 ${reviewAction === 'APPROVE' ? 'bg-green-600' : 'bg-red-600'}`}
              >
                {submitting ? 'Đang xử lý...' : reviewAction === 'APPROVE' ? 'Xác nhận duyệt xóa' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClinicRegistryPage
