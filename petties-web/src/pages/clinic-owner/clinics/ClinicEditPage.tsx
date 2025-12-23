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
            <div className="text-stone-600 font-bold uppercase text-lg mb-2">Clinic Not Found</div>
            <button
              onClick={() => navigate(ROUTES.clinicOwner.clinics)}
              className="btn-brutal-outline mt-4"
            >
              BACK TO LIST
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="heading-brutal text-stone-900 mb-2">EDIT CLINIC</h1>
          <p className="text-stone-600 font-bold uppercase text-sm">Update clinic information</p>
        </div>

        {error && (
          <div className="card-brutal p-4 mb-6 bg-red-50 border-red-600">
            <div className="text-red-800 font-bold uppercase mb-1">Error</div>
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
            }}
            clinicId={currentClinic.clinicId}
            initialImages={currentClinic.images || []}
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

