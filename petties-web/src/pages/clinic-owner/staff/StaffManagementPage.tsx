import { useEffect, useState } from 'react'
import { UserPlusIcon } from '@heroicons/react/24/outline'
import { useClinicStore } from '../../../store/clinicStore'
import { clinicStaffService } from '../../../services/api/clinicStaffService'
import { StaffTable, QuickAddStaffModal } from '../../../components/clinic-staff'
import type { StaffMember, QuickAddStaffRequest } from '../../../types/clinicStaff'

/**
 * Staff Management Page - For Clinic Owner
 * Manage all staff (VET, CLINIC_MANAGER) for owned clinics
 */
export function StaffManagementPage() {
    const { clinics, getMyClinics, isLoading: clinicsLoading } = useClinicStore()
    const [selectedClinicId, setSelectedClinicId] = useState<string>('')
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [hasManager, setHasManager] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Fetch owner's clinics on mount
    useEffect(() => {
        getMyClinics()
    }, [getMyClinics])

    // Auto-select first clinic
    useEffect(() => {
        if (clinics.length > 0 && !selectedClinicId) {
            setSelectedClinicId(clinics[0].clinicId)
        }
    }, [clinics, selectedClinicId])

    // Fetch staff when clinic changes
    useEffect(() => {
        if (selectedClinicId) {
            fetchStaff()
        }
    }, [selectedClinicId])

    const fetchStaff = async () => {
        if (!selectedClinicId) return
        setIsLoading(true)
        setError(null)
        try {
            const [staffData, managerStatus] = await Promise.all([
                clinicStaffService.getClinicStaff(selectedClinicId),
                clinicStaffService.hasManager(selectedClinicId),
            ])
            setStaff(staffData)
            setHasManager(managerStatus)
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Không thể tải danh sách nhân viên')
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddStaff = async (data: QuickAddStaffRequest) => {
        await clinicStaffService.quickAddStaff(selectedClinicId, data)
        await fetchStaff()
    }

    const handleRemoveStaff = async (userId: string) => {
        try {
            await clinicStaffService.removeStaff(selectedClinicId, userId)
            await fetchStaff()
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Không thể xóa nhân viên')
        }
    }

    const selectedClinic = clinics.find((c) => c.clinicId === selectedClinicId)

    return (
        <div className="min-h-screen bg-stone-50 p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold uppercase text-stone-900">
                            QUẢN LÝ NHÂN SỰ
                        </h1>
                        <p className="text-sm font-medium text-stone-600 uppercase mt-1">
                            Quản lý đội ngũ nhân viên phòng khám
                        </p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        disabled={!selectedClinicId || isLoading}
                        className="btn-brutal disabled:opacity-50"
                    >
                        <UserPlusIcon className="w-5 h-5 mr-2" />
                        THÊM NHÂN VIÊN
                    </button>
                </div>

                {/* Clinic Selector */}
                {clinics.length > 1 && (
                    <div className="card-brutal p-4 mb-6">
                        <label className="block text-sm font-bold uppercase text-stone-700 mb-2">
                            CHỌN PHÒNG KHÁM
                        </label>
                        <select
                            value={selectedClinicId}
                            onChange={(e) => setSelectedClinicId(e.target.value)}
                            className="input-brutal"
                            disabled={clinicsLoading}
                        >
                            {clinics.map((clinic) => (
                                <option key={clinic.clinicId} value={clinic.clinicId}>
                                    {clinic.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Single clinic info */}
                {clinics.length === 1 && selectedClinic && (
                    <div className="card-brutal p-4 mb-6">
                        <p className="text-sm text-stone-600 uppercase">Phòng khám:</p>
                        <p className="font-bold text-stone-900 text-lg">{selectedClinic.name}</p>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="card-brutal p-4 mb-6 bg-red-50 border-red-600">
                        <p className="text-red-800 font-bold">{error}</p>
                    </div>
                )}

                {/* No clinics */}
                {!clinicsLoading && clinics.length === 0 && (
                    <div className="card-brutal p-12 text-center">
                        <p className="text-stone-600 font-bold uppercase text-lg mb-2">
                            CHƯA CÓ PHÒNG KHÁM
                        </p>
                        <p className="text-stone-500">
                            Vui lòng tạo phòng khám trước khi quản lý nhân viên
                        </p>
                    </div>
                )}

                {/* Staff Table */}
                {selectedClinicId && (
                    <StaffTable
                        staff={staff}
                        isLoading={isLoading || clinicsLoading}
                        onRemove={handleRemoveStaff}
                        canRemove={true}
                    />
                )}

                {/* Staff count */}
                {staff.length > 0 && (
                    <div className="mt-4 text-sm text-stone-600 font-medium">
                        Tổng cộng: {staff.length} nhân viên
                    </div>
                )}
            </div>

            {/* Add Staff Modal */}
            <QuickAddStaffModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleAddStaff}
                allowedRoles={['VET', 'CLINIC_MANAGER']}
                disabledRoles={hasManager ? ['CLINIC_MANAGER'] : []}
                title="THÊM NHÂN VIÊN MỚI"
            />
        </div>
    )
}

export default StaffManagementPage
