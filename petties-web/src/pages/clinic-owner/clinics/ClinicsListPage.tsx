import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClinicStore } from '../../../store/clinicStore'
import { ClinicList } from '../../../components/clinic/ClinicList'
import { ROUTES } from '../../../config/routes'
import type { ClinicStatus } from '../../../types/clinic'

export function ClinicsListPage() {
  const navigate = useNavigate()
  const { deleteClinic, fetchClinics } = useClinicStore()
  const [statusFilter, setStatusFilter] = useState<ClinicStatus | undefined>(undefined)
  const [searchName, setSearchName] = useState('')

  const handleCreate = () => {
    navigate(`${ROUTES.clinicOwner.clinics}/new`)
  }

  const handleEdit = (clinicId: string) => {
    navigate(`${ROUTES.clinicOwner.clinics}/${clinicId}/edit`)
  }

  const handleDelete = async (clinicId: string) => {
    if (window.confirm('Are you sure you want to delete this clinic?')) {
      try {
        await deleteClinic(clinicId)
        fetchClinics({ status: statusFilter, name: searchName })
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleSearch = () => {
    fetchClinics({ status: statusFilter, name: searchName || undefined })
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="heading-brutal text-stone-900 mb-2">MY CLINICS</h1>
            <p className="text-stone-600 font-bold uppercase text-sm">Manage your veterinary clinics</p>
          </div>
          <button onClick={handleCreate} className="btn-brutal">
            CREATE CLINIC
          </button>
        </div>

        {/* Filters */}
        <div className="card-brutal p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
                STATUS
              </label>
              <select
                value={statusFilter || ''}
                onChange={(e) => setStatusFilter(e.target.value as ClinicStatus | undefined)}
                className="input-brutal"
              >
                <option value="">ALL</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
                SEARCH BY NAME
              </label>
              <input
                type="text"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="input-brutal"
                placeholder="Enter clinic name..."
              />
            </div>
            <div className="flex items-end">
              <button onClick={handleSearch} className="btn-brutal w-full">
                SEARCH
              </button>
            </div>
          </div>
        </div>

        {/* Clinic List */}
        <ClinicList
          filters={{ status: statusFilter, name: searchName || undefined }}
          showActions={true}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </div>
  )
}

