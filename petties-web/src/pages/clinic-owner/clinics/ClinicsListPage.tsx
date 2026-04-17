import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import { useClinicStore } from '../../../store/clinicStore'
import { useSandboxStore } from '../../../store/sandboxStore'
import { ClinicList } from '../../../components/clinic/ClinicList'
import { SandboxGuideModal } from '../../../components/sandbox/SandboxGuideModal'
import { useSandboxStepTracker } from '../../../hooks/useSandboxStepTracker'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { ROUTES } from '../../../config/routes'
import type { ClinicStatus } from '../../../types/clinic'

export function ClinicsListPage() {
  const navigate = useNavigate()
  const { deleteClinic, fetchClinics, getMyClinics } = useClinicStore()
  const { enterSandbox, currentSandboxClinic, isSandboxMode, currentGuideStep } = useSandboxStore()
  const trackSandboxStepAction = useSandboxStepTracker('clinic_info')
  const [statusFilter, setStatusFilter] = useState<ClinicStatus | undefined>(undefined)
  const [searchName, setSearchName] = useState('')
  const [showSandboxModal, setShowSandboxModal] = useState(false)
  const [isLoadingSandbox, setIsLoadingSandbox] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    clinicId: string
  }>({ isOpen: false, clinicId: '' })

  const handleCreate = () => {
    if (isSandboxMode && currentGuideStep < 5) {
      return
    }

    navigate(`${ROUTES.clinicOwner.clinics}/new`)
  }

  const handleEdit = (clinicId: string) => {
    navigate(`${ROUTES.clinicOwner.clinics}/${clinicId}/edit`)
  }

  const handleDeleteClick = (clinicId: string) => {
    setConfirmDialog({ isOpen: true, clinicId })
  }

  const handleConfirmDelete = async () => {
    const { clinicId } = confirmDialog
    setConfirmDialog({ isOpen: false, clinicId: '' })
    try {
      await deleteClinic(clinicId)
      fetchClinics({ status: statusFilter, name: searchName })
    } catch {
      // Error handled by store
    }
  }

  const handleSearch = () => {
    fetchClinics({ status: statusFilter, name: searchName || undefined })
  }

  // Load owner's clinics on first render
  useEffect(() => {
    getMyClinics()
  }, [getMyClinics])

  const handleEnterSandbox = async () => {
    setIsLoadingSandbox(true)
    try {
      await enterSandbox('clinic_info')
      await getMyClinics()
      setShowSandboxModal(false)
    } catch (error) {
      console.error('Lỗi vào chế độ dùng thử:', error)
    } finally {
      setIsLoadingSandbox(false)
    }
  }

  return (
    <>
      <div className="min-h-screen bg-[#FFFDF8] text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-10 border-b-[3px] border-black pb-4" data-sandbox-target="clinic-info-actions">
            <div>
              <div className="inline-block bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-widest">
                QUẢN LÝ PHÒNG KHÁM
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mt-3 leading-tight">
                Phòng Khám Của Tôi
              </h1>
              <p className="text-sm md:text-base font-semibold text-gray-700 mt-2">
                Quản lý tất cả phòng khám thú y của bạn trong một nơi
              </p>
            </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSandboxModal(true)}
                  className="px-5 py-3 font-black uppercase border-[3px] border-black bg-white text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-2"
                >
                  <QuestionMarkCircleIcon className="w-5 h-5" />
                  Hướng dẫn
                </button>
                <button
                  onClick={() => {
                    trackSandboxStepAction('clinic_info.open_create_form', document.activeElement)
                    handleCreate()
                  }}
                  style={{ backgroundColor: 'rgb(255, 107, 53)' }}
                  className="text-white px-5 py-3 font-black uppercase border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Đăng kí phòng khám
                </button>
              </div>
          </div>

          {/* Filters */}
          <div
            className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 mb-8"
            data-sandbox-target="clinic-owner-overview"
            onClick={(e) => trackSandboxStepAction('clinic_info.explore_list', e.target)}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-black uppercase tracking-wider">Trạng thái</span>
                <select
                  value={statusFilter || ''}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as ClinicStatus | undefined)
                    trackSandboxStepAction('clinic_info.explore_list', e.target)
                  }}
                  className="w-full px-3 py-3 border-[3px] border-black bg-white font-semibold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
                >
                  <option value="">Tất cả</option>
                  <option value="PENDING">Chờ duyệt</option>
                  <option value="APPROVED">Đã duyệt</option>
                  <option value="REJECTED">Từ chối</option>
                  <option value="SUSPENDED">Tạm ngưng</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-black uppercase tracking-wider">Tìm theo tên</span>
                <input
                  type="text"
                  value={searchName}
                  onChange={(e) => {
                    setSearchName(e.target.value)
                    if (e.target.value.trim().length > 0) {
                      trackSandboxStepAction('clinic_info.explore_list', e.target)
                    }
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-3 py-3 border-[3px] border-black bg-white font-semibold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
                  placeholder="Nhập tên phòng khám..."
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    handleSearch()
                    trackSandboxStepAction('clinic_info.explore_list', document.activeElement)
                  }}
                  style={{ backgroundColor: 'rgb(255, 107, 53)' }}
                  className="w-full text-white px-4 py-3 font-black uppercase border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Tìm kiếm
                </button>
              </div>
            </div>
          </div>

          {/* Clinic List */}
          <div
            data-sandbox-target="clinic-owner-overview"
            onClick={(e) => trackSandboxStepAction('clinic_info.explore_list', e.target)}
          >
            <ClinicList
              filters={{ status: statusFilter, name: searchName || undefined }}
              showActions={true}
              highlightedClinicId={isSandboxMode ? currentSandboxClinic?.clinicId : null}
              onOpen={(clinicId) => {
                const isDemoClinic = clinicId === currentSandboxClinic?.clinicId
                if (isDemoClinic) {
                  trackSandboxStepAction('clinic_info.open_demo_clinic', document.activeElement)
                }
                navigate(`${ROUTES.clinicOwner.clinics}/${clinicId}`)
              }}
              onEdit={(clinicId) => {
                trackSandboxStepAction('clinic_info.open_edit', document.activeElement)
                handleEdit(clinicId)
              }}
              onDelete={handleDeleteClick}
            />
          </div>

          <SandboxGuideModal
            isOpen={showSandboxModal}
            featureName="Thông tin phòng khám"
            onConfirm={handleEnterSandbox}
            onCancel={() => setShowSandboxModal(false)}
            isLoading={isLoadingSandbox}
          />
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, clinicId: '' })}
        onConfirm={handleConfirmDelete}
        title="Xóa phòng khám"
        message="Bạn có chắc muốn xóa phòng khám này? Hành động này không thể hoàn tác."
        confirmText="Xóa phòng khám"
        cancelText="Hủy bỏ"
        variant="danger"
      />
    </>
  )
}
