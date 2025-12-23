import { useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  StarIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { useClinicStore } from '../../../store/clinicStore'
import { ClinicMapOSM } from '../../../components/clinic/ClinicMapOSM'
import { DistanceCalculator } from '../../../components/clinic/DistanceCalculator'
import { ClinicLogoDisplay } from '../../../components/clinic/ClinicLogoDisplay'
import { ROUTES } from '../../../config/routes'

export function ClinicDetailPage() {
  const { clinicId } = useParams<{ clinicId: string }>()
  const navigate = useNavigate()
  const { currentClinic, fetchClinicById, deleteClinic, isLoading, error } = useClinicStore()

  useEffect(() => {
    if (clinicId) {
      fetchClinicById(clinicId)
    }
  }, [clinicId])

  const handleDelete = async () => {
    if (!clinicId) return
    if (window.confirm('Are you sure you want to delete this clinic? This action cannot be undone.')) {
      try {
        await deleteClinic(clinicId)
        navigate(ROUTES.clinicOwner.clinics)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-stone-600 font-bold uppercase">Loading...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !currentClinic) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="card-brutal p-12 text-center">
            <div className="text-stone-600 font-bold uppercase text-lg mb-2">
              {error || 'Clinic Not Found'}
            </div>
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

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 border-amber-600',
    APPROVED: 'bg-green-100 text-green-800 border-green-600',
    REJECTED: 'bg-red-100 text-red-800 border-red-600',
    SUSPENDED: 'bg-gray-100 text-gray-800 border-gray-600',
  }

  const statusLabels: Record<string, string> = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    SUSPENDED: 'SUSPENDED',
  }

  const DAYS_OF_WEEK = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ] as const

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <Link
              to={ROUTES.clinicOwner.clinics}
              className="text-amber-600 font-bold uppercase text-sm mb-4 inline-block hover:text-amber-700"
            >
              ← BACK TO LIST
            </Link>
            <div className="flex items-center gap-4 mb-2">
              {/* Clinic Logo */}
              <div className="relative w-16 h-16 border-4 border-stone-900 bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                <ClinicLogoDisplay logoUrl={currentClinic.logo} alt={`${currentClinic.name} Logo`} size="md" />
              </div>
              <div className="flex-1">
                <h1 className="heading-brutal text-stone-900">{currentClinic.name}</h1>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div
                className={`inline-block px-3 py-1 border-2 font-bold text-xs uppercase ${statusColors[currentClinic.status] || statusColors.PENDING}`}
              >
                {statusLabels[currentClinic.status] || currentClinic.status}
              </div>
              {currentClinic.ratingAvg > 0 && (
                <div className="flex items-center gap-1">
                  <StarIcon className="w-5 h-5 text-amber-600 fill-amber-600" />
                  <span className="font-bold text-stone-900">{currentClinic.ratingAvg.toFixed(1)}</span>
                  <span className="text-stone-600 text-sm">({currentClinic.ratingCount})</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to={`${ROUTES.clinicOwner.clinics}/${clinicId}/edit`}
              className="btn-brutal-outline"
            >
              <PencilIcon className="w-4 h-4 mr-2" />
              EDIT
            </Link>
            <button onClick={handleDelete} className="btn-brutal-outline text-red-600 border-red-600 hover:bg-red-50">
              <TrashIcon className="w-4 h-4 mr-2" />
              DELETE
            </button>
          </div>
        </div>

        {/* Clinic Images Gallery */}
        {currentClinic.images && currentClinic.images.length > 0 && (
          <div className="card-brutal p-6 mb-6">
            <h2 className="text-lg font-bold uppercase text-stone-900 mb-4">ẢNH PHÒNG KHÁM</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentClinic.images.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <div className="card-brutal overflow-hidden aspect-square">
                    <img
                      src={imageUrl}
                      alt={`${currentClinic.name} - Image ${index + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                      onClick={() => {
                        // Open image in new tab for full view
                        window.open(imageUrl, '_blank')
                      }}
                    />
                  </div>
                  {index === 0 && (
                    <div className="absolute top-2 left-2 bg-amber-600 text-white font-bold uppercase text-xs px-2 py-1 border-2 border-stone-900 shadow-brutal">
                      PRIMARY
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="card-brutal p-6 mb-6">
          <h2 className="text-lg font-bold uppercase text-stone-900 mb-4">THÔNG TIN CƠ BẢN</h2>
          <div className="space-y-3">
            {currentClinic.description && (
              <div>
                <div className="text-sm font-bold uppercase text-stone-600 mb-1">MÔ TẢ</div>
                <div className="text-stone-900">{currentClinic.description}</div>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPinIcon className="w-5 h-5 text-stone-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold uppercase text-stone-600 mb-1">ĐỊA CHỈ</div>
                <div className="text-stone-900">{currentClinic.address}</div>
                {currentClinic.district && (
                  <div className="text-sm text-stone-700 mt-1">
                    <span className="font-bold">Quận/Huyện:</span> {currentClinic.district}
                  </div>
                )}
                {currentClinic.province && (
                  <div className="text-sm text-stone-700 mt-1">
                    <span className="font-bold">Tỉnh/Thành phố:</span> {currentClinic.province}
                  </div>
                )}
                {currentClinic.specificLocation && (
                  <div className="text-sm text-stone-700 mt-1">
                    <span className="font-bold">Vị trí:</span> {currentClinic.specificLocation}
                  </div>
                )}
                {currentClinic.latitude && currentClinic.longitude && (
                  <div className="text-xs text-stone-500 mt-1">
                    {currentClinic.latitude.toFixed(6)}, {currentClinic.longitude.toFixed(6)}
                  </div>
                )}
              </div>
            </div>
            {currentClinic.phone && (
              <div className="flex items-center gap-2">
                <PhoneIcon className="w-5 h-5 text-stone-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold uppercase text-stone-600 mb-1">SỐ ĐIỆN THOẠI</div>
                  <div className="text-stone-900">{currentClinic.phone}</div>
                </div>
              </div>
            )}
            {currentClinic.email && (
              <div className="flex items-center gap-2">
                <EnvelopeIcon className="w-5 h-5 text-stone-600 flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold uppercase text-stone-600 mb-1">EMAIL</div>
                  <div className="text-stone-900">{currentClinic.email}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Operating Hours */}
        {currentClinic.operatingHours && Object.keys(currentClinic.operatingHours).length > 0 && (
          <div className="card-brutal p-6 mb-6">
            <h2 className="text-lg font-bold uppercase text-stone-900 mb-4">GIỜ LÀM VIỆC</h2>
            {/* Check if clinic is 24/7 */}
            {DAYS_OF_WEEK.every((day) => {
              const hours = currentClinic.operatingHours?.[day]
              return hours && !hours.isClosed && hours.openTime === '00:00' && hours.closeTime === '23:59'
            }) ? (
              <div className="p-4 border-4 border-amber-600 bg-amber-50 text-center">
                <div className="text-2xl font-bold uppercase text-stone-900 mb-2">MỞ 24/7</div>
                <div className="text-sm font-bold uppercase text-stone-700">Tất cả các ngày: 00:00 - 23:59</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DAYS_OF_WEEK.map((day) => {
                  const hours = currentClinic.operatingHours?.[day]
                  if (!hours) return null
                  const is24h = !hours.isClosed && hours.openTime === '00:00' && hours.closeTime === '23:59'
                  return (
                    <div key={day} className="border-2 border-stone-900 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-bold uppercase text-stone-900">{day}</div>
                        {is24h && (
                          <span className="text-xs bg-amber-600 text-white px-2 py-1 border-2 border-stone-900 font-bold uppercase">
                            24/7
                          </span>
                        )}
                      </div>
                      {hours.isClosed ? (
                        <div className="text-stone-600 font-bold uppercase text-xs">CLOSED</div>
                      ) : (
                        <div className="text-stone-900">
                          {hours.openTime} - {hours.closeTime}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Map */}
        {currentClinic.latitude && currentClinic.longitude && (
          <div className="card-brutal p-6 mb-6">
            <h2 className="text-lg font-bold uppercase text-stone-900 mb-4">LOCATION</h2>
            <ClinicMapOSM clinic={currentClinic} />
            <div className="mt-4">
              <DistanceCalculator clinicId={currentClinic.clinicId} />
            </div>
          </div>
        )}

        {/* Rejection Reason */}
        {currentClinic.status === 'REJECTED' && currentClinic.rejectionReason && (
          <div className="card-brutal p-6 bg-red-50 border-red-600">
            <h2 className="text-lg font-bold uppercase text-red-800 mb-2">LÝ DO TỪ CHỐI</h2>
            <div className="text-red-700">{currentClinic.rejectionReason}</div>
          </div>
        )}

        {/* Timestamps */}
        <div className="card-brutal p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-stone-600 font-bold uppercase mb-1">CREATED AT</div>
              <div className="text-stone-900">
                {new Date(currentClinic.createdAt).toLocaleString('vi-VN')}
              </div>
            </div>
            {currentClinic.updatedAt && (
              <div>
                <div className="text-stone-600 font-bold uppercase mb-1">UPDATED AT</div>
                <div className="text-stone-900">
                  {new Date(currentClinic.updatedAt).toLocaleString('vi-VN')}
                </div>
              </div>
            )}
            {currentClinic.approvedAt && (
              <div>
                <div className="text-stone-600 font-bold uppercase mb-1">APPROVED AT</div>
                <div className="text-stone-900">
                  {new Date(currentClinic.approvedAt).toLocaleString('vi-VN')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

