import { useEffect } from 'react'
import { useClinicStore } from '../../store/clinicStore'
import { ClinicCard } from './ClinicCard'
import type { ClinicStatus } from '../../types/clinic'

interface ClinicListProps {
  filters?: {
    status?: ClinicStatus
    name?: string
  }
  showActions?: boolean
  onEdit?: (clinicId: string) => void
  onDelete?: (clinicId: string) => void
}

export function ClinicList({ filters, showActions = false, onEdit, onDelete }: ClinicListProps) {
  const {
    clinics,
    isLoading,
    error,
    totalElements,
    totalPages,
    currentPage,
    fetchClinics,
    setFilters,
    getMyClinics,
  } = useClinicStore()

  useEffect(() => {
    if (filters) {
      setFilters(filters)
    }
    // Use getMyClinics to get only owner's clinics, not all clinics in the system
    getMyClinics()
  }, [filters?.status, filters?.name])

  if (isLoading && clinics.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-600 font-bold uppercase">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-brutal p-6 bg-red-50 border-red-600">
        <div className="text-red-800 font-bold uppercase mb-2">Error</div>
        <div className="text-red-700">{error}</div>
      </div>
    )
  }

  if (clinics.length === 0) {
    return (
      <div className="card-brutal p-12 text-center">
        <div className="text-stone-600 font-bold uppercase text-lg mb-2">No Clinics Found</div>
        <div className="text-stone-500">Create your first clinic to get started.</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-stone-700 font-bold uppercase">
          {totalElements} {totalElements === 1 ? 'Clinic' : 'Clinics'}
        </div>
        {totalPages > 1 && (
          <div className="text-stone-600 text-sm">
            Page {currentPage + 1} of {totalPages}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clinics.map((clinic) => (
          <ClinicCard
            key={clinic.clinicId}
            clinic={clinic}
            showActions={showActions}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => fetchClinics({ ...filters, page: currentPage - 1 })}
            disabled={currentPage === 0}
            className="btn-brutal-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={() => fetchClinics({ ...filters, page: currentPage + 1 })}
            disabled={currentPage >= totalPages - 1}
            className="btn-brutal-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

