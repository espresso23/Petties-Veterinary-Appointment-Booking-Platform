import { useEffect, useState } from 'react'
import { UserPlusIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '../../../store/authStore'
import { clinicStaffService } from '../../../services/api/clinicStaffService'
import { StaffTable, QuickAddStaffModal } from '../../../components/clinic-staff'
import type { StaffMember, QuickAddStaffRequest } from '../../../types/clinicStaff'

/**
 * Vets Management Page - For Clinic Manager
 * Only manage VETs (cannot manage other Managers)
 */
export function VetsManagementPage() {
    const user = useAuthStore((state) => state.user)
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

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
            // Filter to show only VETs for Manager view
            const vets = data.filter((s) => s.role === 'VET')
            setStaff(vets)
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Không thể tải danh sách bác sĩ')
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddVet = async (data: QuickAddStaffRequest) => {
        if (!clinicId) return
        // Force role to VET for clinic manager
        await clinicStaffService.quickAddStaff(clinicId, { ...data, role: 'VET' })
        await fetchStaff()
    }

    const handleRemoveVet = async (userId: string) => {
        if (!clinicId) return
        try {
            await clinicStaffService.removeStaff(clinicId, userId)
            await fetchStaff()
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Không thể xóa bác sĩ')
        }
    }

    if (!clinicId) {
        return (
            <div className="min-h-screen bg-stone-50 p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="card-brutal p-12 text-center">
                        <p className="text-stone-600 font-bold uppercase text-lg mb-2">
                            CHƯA ĐƯỢC GÁN PHÒNG KHÁM
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
                            QUẢN LÝ BÁC SĨ
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
                        THÊM BÁC SĨ
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
                    onRemove={handleRemoveVet}
                    canRemove={true}
                />

                {/* Staff count */}
                {staff.length > 0 && (
                    <div className="mt-4 text-sm text-stone-600 font-medium">
                        Tổng cộng: {staff.length} bác sĩ
                    </div>
                )}
            </div>

            {/* Add Vet Modal - Only VET role allowed */}
            <QuickAddStaffModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleAddVet}
                allowedRoles={['VET']}
                title="THÊM BÁC SĨ MỚI"
            />
        </div>
    )
}

export default VetsManagementPage
