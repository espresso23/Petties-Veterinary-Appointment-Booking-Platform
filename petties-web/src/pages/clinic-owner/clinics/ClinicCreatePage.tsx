import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClinicStore } from '../../../store/clinicStore'
import { ClinicForm } from '../../../components/clinic/ClinicForm'
import { ClinicImageUpload } from '../../../components/clinic/ClinicImageUpload'
import { ROUTES } from '../../../config/routes'
import type { ClinicRequest, ClinicResponse } from '../../../types/clinic'

export function ClinicCreatePage() {
  const navigate = useNavigate()
  const { createClinic, fetchClinicById, currentClinic, isLoading, error } = useClinicStore()
  const [createdClinic, setCreatedClinic] = useState<ClinicResponse | null>(null)

  const handleSubmit = async (data: ClinicRequest) => {
    try {
      const clinic = await createClinic(data)
      setCreatedClinic(clinic)
      // Stay on page to allow image upload
    } catch (error) {
      // Error handled by store
    }
  }

  const handleImageUploaded = async () => {
    // Refetch clinic to get updated images
    if (createdClinic) {
      try {
        await fetchClinicById(createdClinic.clinicId)
        // Update local state with clinic from store
        // We'll use currentClinic from store in the component
      } catch (error) {
        console.error('Failed to refetch clinic:', error)
      }
    }
  }

  // Use currentClinic from store if available, otherwise use local state
  const displayClinic = currentClinic?.clinicId === createdClinic?.clinicId ? currentClinic : createdClinic

  const handleContinue = () => {
    if (createdClinic) {
      navigate(`${ROUTES.clinicOwner.clinics}/${createdClinic.clinicId}`)
    }
  }

  const handleCancel = () => {
    navigate(ROUTES.clinicOwner.clinics)
  }

  return (
    <div className="min-h-screen bg-[#FFFDF8] text-black">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 border-b-[3px] border-black pb-4">
          <div className="inline-block bg-black text-white px-3 py-1 text-xs font-black uppercase tracking-widest">
            Tạo mới
          </div>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mt-3 leading-tight">
            Tạo phòng khám
          </h1>
          <p className="text-sm md:text-base font-semibold text-gray-700 mt-2">
            Nhập thông tin phòng khám và hoàn tất hồ sơ
          </p>
        </div>

        {error && (
          <div className="card-brutal p-4 mb-6 bg-red-50 border-red-600">
            <div className="text-red-800 font-bold uppercase mb-1">Lỗi</div>
            <div className="text-red-700">{error}</div>
          </div>
        )}

        {!createdClinic ? (
          <ClinicForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
          />
        ) : displayClinic ? (
          <div className="space-y-6">
            <div className="card-brutal p-6 bg-green-50 border-green-600">
              <div className="text-green-800 font-bold uppercase mb-2">Đăng kí phòng khám thành công!</div>
              <div className="text-green-700">
                Phòng khám "{displayClinic.name}" đã được đăng kí. Bạn có thể tải ảnh phòng khám dưới đây.
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="card-brutal p-6">
              <h3 className="text-lg font-bold uppercase text-stone-900 mb-4">TẢI LÊN ẢNH PHÒNG KHÁM</h3>
              <ClinicImageUpload
                clinicId={displayClinic.clinicId}
                initialImages={displayClinic.imageDetails || []}
                onImageUploaded={handleImageUploaded}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleContinue}
                className="btn-brutal flex-1"
              >
                XEM CHI TIẾT
              </button>
              <button
                onClick={() => navigate(ROUTES.clinicOwner.clinics)}
                className="btn-brutal-outline flex-1"
              >
                QUAY LẠI DANH SÁCH
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

