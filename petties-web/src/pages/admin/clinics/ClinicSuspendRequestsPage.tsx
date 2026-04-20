import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clinicService } from '../../../services/api/clinicService'
import type { ClinicSuspendRequestResponse } from '../../../types/clinic'
import { useToast } from '../../../components/Toast'
import { ConfirmModal } from '../../../components/ConfirmModal'
import { ROUTES } from '../../../config/routes'
import '../../../styles/brutalist.css'

export const ClinicSuspendRequestsPage = () => {
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [requests, setRequests] = useState<ClinicSuspendRequestResponse[]>([])
  const [selectedRequest, setSelectedRequest] = useState<ClinicSuspendRequestResponse | null>(null)
  const [action, setAction] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true)
      const data = await clinicService.getPendingSuspendRequests(page, 20)
      setRequests(data.content)
      setTotalPages(data.totalPages)
      setTotalElements(data.totalElements)
    } catch {
      showToast('error', 'Không thể tải danh sách yêu cầu tạm ngưng')
    } finally {
      setLoading(false)
    }
  }, [page, showToast])

  useEffect(() => {
    void loadRequests()
  }, [loadRequests])

  const handleOpenReview = (request: ClinicSuspendRequestResponse, nextAction: 'APPROVED' | 'REJECTED') => {
    setSelectedRequest(request)
    setAction(nextAction)
  }

  const handleConfirm = async () => {
    if (!selectedRequest || !action || submitting) return
    setSubmitting(true)
    try {
      await clinicService.reviewSuspendRequest(selectedRequest.clinicSuspendRequestId, { status: action })
      const actionLabel = selectedRequest.requestType === 'UNSUSPEND' ? 'bỏ tạm ngưng' : 'tạm ngưng'
      showToast('success', action === 'APPROVED' ? `Đã duyệt yêu cầu ${actionLabel}` : `Đã từ chối yêu cầu ${actionLabel}`)
      setSelectedRequest(null)
      setAction(null)
      await loadRequests()
    } catch (error) {
      const message = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined
      showToast('error', message || 'Không thể xử lý yêu cầu')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">Yêu cầu tạm ngưng phòng khám</h1>
          <p className="text-stone-600 mt-1">Tổng số yêu cầu chờ xử lý: {totalElements}</p>
        </div>
        <Link
          to={ROUTES.admin.clinicSuspensions}
          className="text-sm font-bold uppercase border-2 border-stone-900 px-4 py-2 shadow-[3px_3px_0_#1c1917] bg-white hover:translate-x-[-2px] hover:translate-y-[-2px]"
        >
          Trang yêu cầu
        </Link>
      </header>

      <div className="bg-white border-4 border-stone-900 shadow-brutal overflow-hidden">
        {loading && requests.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-stone-600 font-bold">Đang tải...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-stone-600 font-bold uppercase">Không có yêu cầu nào đang chờ duyệt</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-4 border-stone-900 bg-stone-100">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Phòng khám</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Người gửi</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Loại đơn</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Lý do</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase">Trạng thái clinic</th>
                  <th className="px-4 py-3 text-center text-xs font-bold uppercase">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.clinicSuspendRequestId} className="border-b-2 border-stone-200 hover:bg-amber-50 align-top">
                    <td className="px-4 py-4">
                      <div className="font-bold text-stone-900">{request.clinicName}</div>
                      <div className="text-xs text-stone-500 font-mono">{request.clinicId}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-stone-900">{request.requestedByName || '—'}</div>
                      <div className="text-xs text-stone-500">{request.requestedById}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase border-2 border-stone-900 bg-white">
                        {request.requestType === 'UNSUSPEND' ? 'Bỏ tạm ngưng' : 'Tạm ngưng'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-stone-700 max-w-[320px] whitespace-pre-wrap">{request.reason}</td>
                    <td className="px-4 py-4">
                      <span className="px-2 py-1 text-[10px] font-bold uppercase border-2 border-stone-900 bg-stone-100">
                        {request.clinicStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button
                          type="button"
                          onClick={() => handleOpenReview(request, 'APPROVED')}
                          className="px-3 py-1.5 bg-green-100 text-green-900 text-xs font-bold uppercase border-2 border-green-900 shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
                        >
                          Duyệt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenReview(request, 'REJECTED')}
                          className="px-3 py-1.5 bg-red-100 text-red-900 text-xs font-bold uppercase border-2 border-red-900 shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
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

      <ConfirmModal
        isOpen={selectedRequest !== null && action !== null}
        title={action === 'APPROVED' ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu'}
        message={selectedRequest ? `Bạn có chắc muốn ${action === 'APPROVED' ? 'duyệt' : 'từ chối'} yêu cầu ${selectedRequest.requestType === 'UNSUSPEND' ? 'bỏ tạm ngưng' : 'tạm ngưng'} của "${selectedRequest.clinicName}" không?` : ''}
        confirmLabel={action === 'APPROVED' ? 'Duyệt' : 'Từ chối'}
        cancelLabel="Hủy"
        isDanger={action === 'REJECTED'}
        onConfirm={() => void handleConfirm()}
        onCancel={() => !submitting && (setSelectedRequest(null), setAction(null))}
      />
    </div>
  )
}

export default ClinicSuspendRequestsPage