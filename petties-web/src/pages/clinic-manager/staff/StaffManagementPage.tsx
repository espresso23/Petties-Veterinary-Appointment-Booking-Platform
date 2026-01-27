import { useEffect, useState } from 'react'
import { UserPlusIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../../store/authStore'
import { clinicStaffService } from '../../../services/api/clinicStaffService'
import { StaffTable, QuickAddStaffModal, EditSpecialtyModal } from '../../../components/clinic-staff'
import type { StaffMember, InviteByEmailRequest, StaffSpecialty } from '../../../types/clinicStaff'

/**
 * Staff Management Page - For Clinic Manager
 * Only manage STAFFs (cannot manage other Managers)
 */
export function StaffManagementPage() {
    const user = useAuthStore((state) => state.user)
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingMember, setEditingMember] = useState<StaffMember | null>(null)

    // Get clinicId directly from user (after authStore update)
    const clinicId = user?.workingClinicId
    const clinicName = user?.workingClinicName

    useEffect(() => {
        if (clinicId) {
            fetchStaff()
            console.log(clinicId)
        }
    }, [clinicId])

    const fetchStaff = async () => {
        if (!clinicId) return
        setIsLoading(true)
        setError(null)
        try {
            const data = await clinicStaffService.getClinicStaff(clinicId)
            // Filter to show only STAFFs for Manager view
            const vets = data.filter((s) => s.role === 'STAFF')
            setStaff(vets)
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Không thể tải danh sách nhân viên')
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddStaff = async (data: InviteByEmailRequest) => {
        if (!clinicId) return
        // Force role to STAFF for clinic manager
        await clinicStaffService.inviteByEmail(clinicId, { ...data, role: 'STAFF' })
        await fetchStaff()
    }

    const handleRemoveStaff = async (userId: string) => {
        if (!clinicId) return
        try {
            await clinicStaffService.removeStaff(clinicId, userId)
            await fetchStaff()
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Không thể xóa nhân viên')
        }
    }

    const handleEditSpecialty = (member: StaffMember) => {
        setEditingMember(member)
    }

    const handleUpdateSpecialty = async (specialty: StaffSpecialty) => {
        if (!editingMember || !clinicId) return
        await clinicStaffService.updateStaffSpecialty(clinicId, editingMember.userId, specialty)
        setEditingMember(null)
        await fetchStaff()
    }

    if (!clinicId) {
        return (
            <div className="min-h-screen bg-stone-50 p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="card-brutal p-12 text-center">
                        <p className="text-stone-600 font-bold uppercase text-lg mb-2">
                            CHƯA ĐƯỢC GÁN VÀO PHÒNG KHÁM
                        </p>
                        <p className="text-stone-500">
                            Vui lòng liên hệ Chủ phòng khám để được gán vào phòng khám
                        </p>
                        <p className="text-xs text-stone-400 mt-4">
                            Bạn cần đăng xuất và đăng nhập lại sau khi được gán.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-stone-50 p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold uppercase text-stone-900">
                            QUẢN LÝ NHÂN SỰ
                        </h1>
                        <p className="text-sm font-medium text-stone-600 mt-1">
                            Phòng khám: <span className="text-amber-600 font-bold">{clinicName || 'N/A'}</span>
                        </p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        disabled={isLoading}
                        className="btn-brutal disabled:opacity-50"
                    >
                        <UserPlusIcon className="w-5 h-5 mr-2" />
                        THÊM NHÂN SỰ
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="card-brutal p-4 mb-6 bg-red-50 border-red-600">
                        <p className="text-red-800 font-bold">{error}</p>
                    </div>
                )}

                {/* Staff Table */}
                <StaffTable
                    staff={staff}
                    isLoading={isLoading}
                    onRemove={handleRemoveStaff}
                    onEditSpecialty={handleEditSpecialty}
                    canRemove={true}
                    canEdit={true}
                />

                {/* Staff count */}
                {staff.length > 0 && (
                    <div className="mt-4 text-sm text-stone-600 font-medium">
                        Tổng cộng: {staff.length} nhân viên
                    </div>
                )}
            </div>

            {/* Add Staff Modal - Only STAFF role allowed */}
            <QuickAddStaffModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleAddStaff}
                allowedRoles={['STAFF']}
                title="THÊM NHÂN VIÊN MỚI"
            />

            {/* Edit Specialty Modal */}
            <EditSpecialtyModal
                isOpen={editingMember !== null}
                onClose={() => setEditingMember(null)}
                onSubmit={handleUpdateSpecialty}
                currentSpecialty={editingMember?.specialty || 'VET_GENERAL'}
                staffName={editingMember?.fullName || ''}
            />
        </div>
    )
}

export default StaffManagementPage

