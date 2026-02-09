import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClinicStore } from '../../../store/clinicStore'
import { useAuthStore } from '../../../store/authStore'
import { ClinicForm } from '../../../components/clinic/ClinicForm'
import type { ClinicRequest } from '../../../types/clinic'

export function ClinicEditPage() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const clinicId = user?.workingClinicId
    const { currentClinic, fetchClinicById, updateClinic, isLoading, error } = useClinicStore()

    const handleImageUploaded = () => {
        if (clinicId) {
            fetchClinicById(clinicId)
        }
    }

    useEffect(() => {
        if (clinicId) {
            fetchClinicById(clinicId)
        }
    }, [clinicId, fetchClinicById])

    const handleSubmit = async (data: ClinicRequest) => {
        if (!clinicId) return
        try {
            await updateClinic(clinicId, data)
            navigate('/clinic-manager/clinic')
        } catch (error) {
            // Error handled by store
        }
    }

    const handleCancel = () => {
        navigate('/clinic-manager/clinic')
    }

    if (!currentClinic && !isLoading) {
        return (
            <div className="p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="card-brutal p-12 text-center">
                        <div className="text-stone-600 font-bold uppercase text-lg mb-2">Không tìm thấy phòng khám được gán</div>
                        <button
                            onClick={() => navigate('/clinic-manager')}
                            className="btn-brutal-outline mt-4"
                        >
                            QUAY LẠI DASHBOARD
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#FFFDF8] text-black">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="mb-8 border-b-[3px] border-black pb-4">
                    <div className="inline-block bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-widest">
                        Chỉnh sửa
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mt-3 leading-tight">
                        Chỉnh sửa phòng khám
                    </h1>
                    <p className="text-sm md:text-base font-semibold text-gray-700 mt-2">
                        Quản lý cấu hình phòng khám (bao gồm Phí SOS và Giờ làm việc)
                    </p>
                </div>

                {error && (
                    <div className="card-brutal p-4 mb-6 bg-red-50 border-red-600">
                        <div className="text-red-800 font-bold uppercase mb-1">Lỗi</div>
                        <div className="text-red-700">{error}</div>
                    </div>
                )}

                {currentClinic && (
                    <ClinicForm
                        initialData={{
                            name: currentClinic.name,
                            description: currentClinic.description,
                            address: currentClinic.address,
                            district: currentClinic.district,
                            province: currentClinic.province,
                            specificLocation: currentClinic.specificLocation,
                            phone: currentClinic.phone,
                            email: currentClinic.email,
                            operatingHours: currentClinic.operatingHours,
                            businessLicenseUrl: currentClinic.businessLicenseUrl,
                            logo: currentClinic.logo,
                            sosFee: currentClinic.sosFee,
                            bankName: currentClinic.bankName,
                            accountNumber: currentClinic.accountNumber,
                        }}
                        clinicId={currentClinic.clinicId}
                        initialImages={currentClinic.imageDetails || []}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                        isLoading={isLoading}
                        onImageUploaded={handleImageUploaded}
                    />
                )}
            </div>
        </div>
    )
}
