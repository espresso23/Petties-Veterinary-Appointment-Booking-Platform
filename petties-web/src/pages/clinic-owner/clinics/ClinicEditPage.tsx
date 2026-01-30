import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClinicStore } from '../../../store/clinicStore'
import { ClinicForm } from '../../../components/clinic/ClinicForm'
import { ROUTES } from '../../../config/routes'
import type { ClinicRequest } from '../../../types/clinic'

export function ClinicEditPage() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const navigate = useNavigate()
  const { currentClinic, fetchClinicById, updateClinic, isLoading, error } = useClinicStore()

  const handleImageUploaded = () => {
    // Refetch clinic to get updated images
    if (clinicId) {
      fetchClinicById(clinicId)
    }
  }

  useEffect(() => {
    if (clinicId) {
      fetchClinicById(clinicId)
    }
  }, [clinicId])

  const handleSubmit = async (data: ClinicRequest) => {
    if (!clinicId) return
    try {
      await updateClinic(clinicId, data)
      navigate(`${ROUTES.clinicOwner.clinics}/${clinicId}`)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleCancel = () => {
    if (clinicId) {
      navigate(`${ROUTES.clinicOwner.clinics}/${clinicId}`)
    } else {
      navigate(ROUTES.clinicOwner.clinics)
    }
  }

  if (!currentClinic && !isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="card-brutal p-12 text-center">
            <div className="text-stone-600 font-bold uppercase text-lg mb-2">Không tìm thấy phòng khám</div>
            <button
              onClick={() => navigate(ROUTES.clinicOwner.clinics)}
              className="btn-brutal-outline mt-4"
            >
              QUAY LẠI DANH SÁCH
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
            Cập nhật thông tin phòng khám hiện có
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

