import { useState, useEffect } from 'react'
import { clinicService } from '../../../services/api/clinicService'
import type { ClinicResponse, ClinicListResponse } from '../../../types/clinic'
import { ClinicDetailModal } from '../../../components/admin/ClinicDetailModal'
import { ApproveRejectModal } from '../../../components/admin/ApproveRejectModal'
import { useToast } from '../../../components/Toast'
import { ArrowPathIcon, EyeIcon } from '@heroicons/react/24/outline'
import '../../../styles/brutalist.css'

/**
 * Admin Clinic Approval Page - Neobrutalism Design
 * Table showing pending clinics with approve/reject actions
 */
export const ClinicApprovalPage = () => {
  const [clinics, setClinics] = useState<ClinicResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClinic, setSelectedClinic] = useState<ClinicResponse | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const { showToast } = useToast()

  const loadPendingClinics = async () => {
    try {
      setLoading(true)
      const data: ClinicListResponse = await clinicService.getPendingClinics(page, 20)
      setClinics(data.content)
      setTotalPages(data.totalPages)
      setTotalElements(data.totalElements)
    } catch (error: any) {
      showToast('error', 'Không thể tải danh sách phòng khám')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPendingClinics()
  }, [page])

  const handleViewDetail = (clinic: ClinicResponse) => {
    setSelectedClinic(clinic)
    setShowDetailModal(true)
  }

  const handleApprove = (clinic: ClinicResponse) => {
    setSelectedClinic(clinic)
    setShowApproveModal(true)
  }

  const handleReject = (clinic: ClinicResponse) => {
    setSelectedClinic(clinic)
    setShowRejectModal(true)
  }

  const handleApproveSuccess = async (reason?: string) => {
    if (!selectedClinic || isProcessing) return
    setIsProcessing(true)
    try {
      await clinicService.approveClinic(selectedClinic.clinicId, reason)
      showToast('success', 'Phòng khám đã được duyệt thành công')
      setShowApproveModal(false)
      setSelectedClinic(null)
      await loadPendingClinics()
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Không thể duyệt phòng khám')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectSuccess = async (reason?: string) => {
    if (!selectedClinic || !reason || isProcessing) return
    setIsProcessing(true)
    try {
      await clinicService.rejectClinic(selectedClinic.clinicId, reason)
      showToast('success', 'Phòng khám đã bị từ chối')
      setShowRejectModal(false)
      setSelectedClinic(null)
      await loadPendingClinics()
    } catch (error: any) {
      showToast('error', error.response?.data?.message || 'Không thể từ chối phòng khám')
    } finally {
      setIsProcessing(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="p-6 bg-stone-50 min-h-screen">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 uppercase tracking-wide">
            QUẢN LÝ CLINIC
          </h1>
          <p className="text-stone-600 mt-1">
            Duyệt phòng khám đang chờ ({totalElements} phòng khám)
          </p>
        </div>
        <button
          onClick={loadPendingClinics}
          disabled={loading}
          className="btn-brutal py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          LÀM MỚI
        </button>
      </header>

      {/* Table */}
      <div className="bg-white border-4 border-stone-900 shadow-brutal">
        {loading && clinics.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-stone-600 font-bold">Đang tải...</p>
          </div>
        ) : clinics.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-stone-600 font-bold uppercase">Không có phòng khám nào đang chờ duyệt</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-4 border-stone-900 bg-stone-100">
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wide text-stone-900">
                      Tên phòng khám
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wide text-stone-900">
                      Chủ sở hữu
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wide text-stone-900">
                      Địa chỉ
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wide text-stone-900">
                      Ngày đăng ký
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wide text-stone-900">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.map((clinic) => (
                    <tr
                      key={clinic.clinicId}
                      className="border-b-2 border-stone-300 hover:bg-amber-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-stone-900">{clinic.name}</div>
                        {clinic.phone && (
                          <div className="text-sm text-stone-600 mt-1">{clinic.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-stone-900">
                          {clinic.owner?.fullName || clinic.owner?.username || 'N/A'}
                        </div>
                        {clinic.owner?.email && (
                          <div className="text-sm text-stone-600 mt-1">{clinic.owner.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-stone-900">{clinic.address}</div>
                        {(clinic.district || clinic.province) && (
                          <div className="text-sm text-stone-600 mt-1">
                            {[clinic.district, clinic.province].filter(Boolean).join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-stone-700">
                        {formatDate(clinic.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewDetail(clinic)}
                            className="px-3 py-1.5 bg-stone-100 text-stone-900 text-xs font-bold uppercase border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all flex items-center gap-1"
                          >
                            <EyeIcon className="w-4 h-4" />
                            Xem
                          </button>
                          <button
                            onClick={() => handleApprove(clinic)}
                            className="px-3 py-1.5 bg-green-100 text-green-900 text-xs font-bold uppercase border-2 border-green-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all"
                          >
                            Duyệt
                          </button>
                          <button
                            onClick={() => handleReject(clinic)}
                            className="px-3 py-1.5 bg-red-100 text-red-900 text-xs font-bold uppercase border-2 border-red-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="border-t-4 border-stone-900 p-4 flex items-center justify-between bg-stone-50">
                <div className="text-sm font-bold text-stone-700">
                  Trang {page + 1} / {totalPages} ({totalElements} phòng khám)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 bg-white text-stone-900 text-sm font-bold uppercase border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 bg-white text-stone-900 text-sm font-bold uppercase border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-px hover:translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {selectedClinic && (
        <>
          <ClinicDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false)
              setSelectedClinic(null)
            }}
            clinic={selectedClinic}
          />
          <ApproveRejectModal
            isOpen={showApproveModal}
            onClose={() => {
              setShowApproveModal(false)
              setSelectedClinic(null)
            }}
            clinic={selectedClinic}
            type="approve"
            onConfirm={handleApproveSuccess}
          />
          <ApproveRejectModal
            isOpen={showRejectModal}
            onClose={() => {
              setShowRejectModal(false)
              setSelectedClinic(null)
            }}
            clinic={selectedClinic}
            type="reject"
            onConfirm={handleRejectSuccess}
          />
        </>
      )}
    </div>
  )
}

export default ClinicApprovalPage

