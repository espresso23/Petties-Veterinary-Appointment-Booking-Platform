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
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="heading-brutal text-stone-900 mb-2">CREATE CLINIC</h1>
          <p className="text-stone-600 font-bold uppercase text-sm">Add a new veterinary clinic</p>
        </div>

        {error && (
          <div className="card-brutal p-4 mb-6 bg-red-50 border-red-600">
            <div className="text-red-800 font-bold uppercase mb-1">Error</div>
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
              <div className="text-green-800 font-bold uppercase mb-2">CLINIC CREATED SUCCESSFULLY!</div>
              <div className="text-green-700">
                Clinic "{displayClinic.name}" has been created. You can now upload images below.
              </div>
            </div>

            {/* Image Upload Section */}
            <div className="card-brutal p-6">
              <h3 className="text-lg font-bold uppercase text-stone-900 mb-4">UPLOAD ẢNH PHÒNG KHÁM</h3>
              <ClinicImageUpload
                clinicId={displayClinic.clinicId}
                initialImages={displayClinic.images || []}
                onImageUploaded={handleImageUploaded}
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleContinue}
                className="btn-brutal flex-1"
              >
                VIEW CLINIC DETAIL
              </button>
              <button
                onClick={() => navigate(ROUTES.clinicOwner.clinics)}
                className="btn-brutal-outline flex-1"
              >
                BACK TO LIST
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

