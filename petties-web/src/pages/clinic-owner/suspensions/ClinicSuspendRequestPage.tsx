import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '../../../store/authStore'
import { useClinicStore } from '../../../store/clinicStore'
import { clinicService } from '../../../services/api/clinicService'
import type { ClinicSuspendRequestResponse } from '../../../types/clinic'
import { useToast } from '../../../components/Toast'
import { ROUTES } from '../../../config/routes'
import { Link } from 'react-router-dom'
import '../../../styles/brutalist.css'

export const ClinicSuspendRequestPage = () => {
  const { user } = useAuthStore()
  const { clinics, getMyClinics, isLoading: clinicsLoading } = useClinicStore()
  const { showToast } = useToast()

  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requests, setRequests] = useState<ClinicSuspendRequestResponse[]>([])

  const selectedClinic = useMemo(
    () => clinics.find((clinic) => clinic.clinicId === selectedClinicId) ?? null,
    [clinics, selectedClinicId]
  )

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true)
    try {
      const data = await clinicService.getMySuspendRequests()
      setRequests(data)
    } catch {
      showToast('error', 'Không thể tải danh sách yêu cầu tạm ngưng')
    } finally {
      setLoadingRequests(false)
    }
  }, [showToast])

  useEffect(() => {
    void getMyClinics()
    void loadRequests()
  }, [getMyClinics, loadRequests])

  useEffect(() => {
    if (!selectedClinicId && clinics.length > 0) {
      setSelectedClinicId(clinics[0].clinicId)
    }
  }, [clinics, selectedClinicId])

  const handleSubmit = async () => {
    if (!selectedClinicId) {
      showToast('error', 'Vui lòng chọn phòng khám')
      return
    }
    if (reason.trim().length < 10) {
      showToast('error', 'Lý do phải có ít nhất 10 ký tự')
      return
    }

    setSubmitting(true)
    try {
      await clinicService.createSuspendRequest({
        clinicId: selectedClinicId,
        reason: reason.trim(),
      })
      showToast('success', 'Đã gửi yêu cầu tạm ngưng phòng khám')
      setReason('')
      await loadRequests()
    } catch (error) {
      const message = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined
      showToast('error', message || 'Không thể gửi yêu cầu tạm ngưng')
    } finally {
      setSubmitting(false)
    }
  }

  const statusLabel = (status: ClinicSuspendRequestResponse['status']) => {
    switch (status) {
      case 'PENDING': return 'Chờ duyệt'
      case 'APPROVED': return 'Đã duyệt'
      case 'REJECTED': return 'Từ chối'
      default: return status
    }
  }

  const clinicStatusLabel = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Đang hoạt động'
      case 'SUSPENDED': return 'Tạm ngưng'
      case 'PENDING': return 'Chờ duyệt'
      case 'REJECTED': return 'Bị từ chối'
      default: return status
    }
  }

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-stone-500 tracking-wide">Chủ phòng khám</p>
          <h1 className="text-2xl font-bold text-stone-900">Yêu cầu tạm ngưng phòng khám</h1>
          <p className="text-stone-600 mt-1">Xin chào, {user?.fullName || 'Chủ phòng khám'}</p>
        </div>
        <Link
          to={ROUTES.clinicOwner.dashboard}
          className="text-sm font-bold uppercase border-2 border-stone-900 px-4 py-2 shadow-[3px_3px_0_#1c1917] bg-white hover:translate-x-[-2px] hover:translate-y-[-2px]"
        >
          Về bảng điều khiển
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border-4 border-stone-900 shadow-brutal p-6">
          <h2 className="text-lg font-bold text-stone-900 uppercase mb-4">Tạo yêu cầu mới</h2>

          {clinicsLoading && <p className="text-stone-600 mb-4">Đang tải phòng khám...</p>}

          {!clinicsLoading && clinics.length === 0 && (
            <div className="border-2 border-stone-900 bg-amber-50 p-4 text-sm font-medium text-stone-800">
              Bạn chưa có phòng khám nào để gửi yêu cầu.
            </div>
          )}

          {clinics.length > 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Phòng khám</label>
                <select
                  value={selectedClinicId}
                  onChange={(e) => setSelectedClinicId(e.target.value)}
                  className="w-full border-2 border-stone-900 px-3 py-2 bg-white font-medium"
                >
                  {clinics.map((clinic) => (
                    <option key={clinic.clinicId} value={clinic.clinicId}>
                      {clinic.name} - {clinicStatusLabel(clinic.status)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedClinic && (
                <div className="border-2 border-stone-900 bg-stone-50 p-4 text-sm">
                  <p className="font-bold text-stone-800">Trạng thái hiện tại: {clinicStatusLabel(selectedClinic.status)}</p>
                  <p className="text-stone-600 mt-1">Địa chỉ: {selectedClinic.address}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-stone-500 mb-1">Lý do tạm ngưng</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  className="w-full border-2 border-stone-900 px-3 py-2 bg-white font-medium"
                  placeholder="Mô tả lý do, ví dụ: nghỉ bảo trì, thay đổi nhân sự, tạm đóng cửa..."
                />
                <p className="text-xs text-stone-500 mt-1">Tối thiểu 10 ký tự.</p>
              </div>

              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || clinics.length === 0}
                className="btn-brutal py-3 px-5 text-sm uppercase font-bold disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          )}
        </section>

        <section className="bg-white border-4 border-stone-900 shadow-brutal p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-stone-900 uppercase">Lịch sử yêu cầu</h2>
            <button
              type="button"
              onClick={() => void loadRequests()}
              className="text-sm font-bold uppercase border-2 border-stone-900 px-3 py-1 bg-white shadow-[2px_2px_0_#1c1917]"
            >
              Làm mới
            </button>
          </div>

          {loadingRequests ? (
            <p className="text-stone-600">Đang tải...</p>
          ) : requests.length === 0 ? (
            <p className="text-stone-600">Chưa có yêu cầu nào.</p>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-auto pr-1">
              {requests.map((request) => (
                <article key={request.clinicSuspendRequestId} className="border-2 border-stone-900 p-4 bg-stone-50 shadow-[3px_3px_0_#1c1917]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-stone-900">{request.clinicName}</h3>
                      <p className="text-xs text-stone-500 uppercase font-bold mt-1">{statusLabel(request.status)}</p>
                    </div>
                    <span className="px-2 py-1 text-[10px] font-bold uppercase border-2 border-stone-900 bg-white">
                      {request.clinicStatus}
                    </span>
                  </div>
                  <p className="text-sm text-stone-700 mt-3 whitespace-pre-wrap">{request.reason}</p>
                  {request.adminNote && (
                    <div className="mt-3 border-2 border-stone-900 bg-white p-3 text-sm">
                      <p className="text-xs font-bold uppercase text-stone-500 mb-1">Ghi chú quản trị</p>
                      <p className="text-stone-800 whitespace-pre-wrap">{request.adminNote}</p>
                    </div>
                  )}
                  <p className="text-xs text-stone-500 mt-3">
                    Tạo lúc: {new Date(request.createdAt).toLocaleString('vi-VN')}
                  </p>
                  {request.reviewedAt && (
                    <p className="text-xs text-stone-500">
                      Duyệt lúc: {new Date(request.reviewedAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default ClinicSuspendRequestPage