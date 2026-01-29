import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClinicStore } from '../../../store/clinicStore'
import { ClinicList } from '../../../components/clinic/ClinicList'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog'
import { ROUTES } from '../../../config/routes'
import type { ClinicStatus } from '../../../types/clinic'

export function ClinicsListPage() {
  const navigate = useNavigate()
  const { deleteClinic, fetchClinics } = useClinicStore()
  const [statusFilter, setStatusFilter] = useState<ClinicStatus | undefined>(undefined)
  const [searchName, setSearchName] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    clinicId: string
  }>({ isOpen: false, clinicId: '' })

  const handleCreate = () => {
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
    } catch (error) {
      // Error handled by store
    }
  }

  const handleSearch = () => {
    fetchClinics({ status: statusFilter, name: searchName || undefined })
  }

  return (
    <>
      <div className="min-h-screen bg-[#FFFDF8] text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4 mb-10 border-b-[3px] border-black pb-4">
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
            <button
              onClick={handleCreate}
              style={{ backgroundColor: 'rgb(255, 107, 53)' }}
              className="text-white px-5 py-3 font-black uppercase border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all"
            >
              Tạo phòng khám
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-black uppercase tracking-wider">Trạng thái</span>
                <select
                  value={statusFilter || ''}
                  onChange={(e) => setStatusFilter(e.target.value as ClinicStatus | undefined)}
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
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-3 py-3 border-[3px] border-black bg-white font-semibold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
                  placeholder="Nhập tên phòng khám..."
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleSearch}
                  style={{ backgroundColor: 'rgb(255, 107, 53)' }}
                  className="w-full text-white px-4 py-3 font-black uppercase border-[3px] border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Tìm kiếm
                </button>
              </div>
            </div>
          </div>

          {/* Clinic List */}
          <ClinicList
            filters={{ status: statusFilter, name: searchName || undefined }}
            showActions={true}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
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
