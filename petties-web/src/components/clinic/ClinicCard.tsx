import { MapPinIcon, PhoneIcon, EnvelopeIcon, StarIcon } from '@heroicons/react/24/outline'
import type { ClinicResponse } from '../../types/clinic'
import { ClinicLogoDisplay } from './ClinicLogoDisplay'

interface ClinicCardProps {
  clinic: ClinicResponse
  showActions?: boolean
  onEdit?: (clinicId: string) => void
  onDelete?: (clinicId: string) => void
  onOpen?: (clinicId: string) => void
  highlighted?: boolean
}

export function ClinicCard({ clinic, showActions = false, onEdit, onDelete, onOpen, highlighted = false }: ClinicCardProps) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800 border-amber-600',
    APPROVED: 'bg-green-100 text-green-800 border-green-600',
    REJECTED: 'bg-red-100 text-red-800 border-red-600',
    SUSPENDED: 'bg-gray-100 text-gray-800 border-gray-600',
  }

  const statusLabels: Record<string, string> = {
    PENDING: 'CHỜ DUYỆT',
    APPROVED: 'ĐÃ DUYỆT',
    REJECTED: 'TỪ CHỐI',
    SUSPENDED: 'TẠM NGƯNG',
  }

  const getImageUrl = (image: string | { imageUrl: string }): string => {
    if (typeof image === 'string') return image
    return image.imageUrl
  }

  const primaryImage = clinic.images && clinic.images.length > 0
    ? getImageUrl(clinic.images[0])
    : null

  const cardClasses = highlighted
    ? 'card-brutal overflow-hidden ring-4 ring-amber-500 shadow-[12px_12px_0_#1c1917] scale-[1.01]'
    : 'card-brutal overflow-hidden'

  const handleOpen = () => {
    if (onOpen) {
      onOpen(clinic.clinicId)
    }
  }

  return (
    <div
      className={`${cardClasses} ${onOpen ? 'cursor-pointer' : ''}`}
      data-sandbox-target={highlighted ? 'clinic-info-demo-clinic' : undefined}
      onClick={onOpen ? handleOpen : undefined}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
    >
      {/* Clinic Image */}
      {primaryImage ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); handleOpen() }} className="block w-full text-left">
          <div className="relative w-full h-48 bg-stone-200 overflow-hidden">
            <img
              src={primaryImage}
              alt={clinic.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
            {clinic.images && clinic.images.length > 1 && (
              <div className="absolute top-2 right-2 bg-stone-900 text-white font-bold uppercase text-xs px-2 py-1 border-2 border-white shadow-brutal">
                +{clinic.images.length - 1}
              </div>
            )}
            {/* Logo overlay */}
            <div className="absolute top-2 left-2 w-12 h-12 border-2 border-white bg-white flex items-center justify-center overflow-hidden shadow-brutal">
              <ClinicLogoDisplay logoUrl={clinic.logo} alt={`${clinic.name} Logo`} size="sm" />
            </div>
          </div>
        </button>
      ) : (
        <button type="button" onClick={(e) => { e.stopPropagation(); handleOpen() }} className="relative w-full h-48 bg-stone-200 flex items-center justify-center text-left">
          <div className="text-stone-400 font-bold uppercase text-sm">NO IMAGE</div>
          {/* Logo overlay even when no image */}
          <div className="absolute top-2 left-2 w-12 h-12 border-2 border-stone-900 bg-white flex items-center justify-center overflow-hidden shadow-brutal">
            <ClinicLogoDisplay logoUrl={clinic.logo} alt={`${clinic.name} Logo`} size="sm" />
          </div>
        </button>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <button type="button" onClick={(e) => { e.stopPropagation(); handleOpen() }} className="block text-left group w-full">
              <h3 className="text-xl font-bold text-stone-900 mb-2 group-hover:text-amber-600 transition-colors">
                {clinic.name}
              </h3>
            </button>
            <div className={`inline-block px-3 py-1 border-2 font-bold text-xs uppercase ${statusColors[clinic.status] || statusColors.PENDING}`}>
              {statusLabels[clinic.status] || clinic.status}
            </div>
          </div>
          {clinic.ratingAvg > 0 && (
            <div className="flex items-center gap-1">
              <StarIcon className="w-5 h-5 text-amber-600 fill-amber-600" />
              <span className="font-bold text-stone-900">{clinic.ratingAvg.toFixed(1)}</span>
              <span className="text-stone-600 text-sm">({clinic.ratingCount})</span>
            </div>
          )}
        </div>

        {clinic.description && (
          <p className="text-stone-700 mb-4 line-clamp-2">{clinic.description}</p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-start gap-2">
            <MapPinIcon className="w-5 h-5 text-stone-600 mt-0.5 flex-shrink-0" />
            <span className="text-stone-700 text-sm">{clinic.address}</span>
          </div>
          {clinic.phone && (
            <div className="flex items-center gap-2">
              <PhoneIcon className="w-5 h-5 text-stone-600 flex-shrink-0" />
              <span className="text-stone-700 text-sm">{clinic.phone}</span>
            </div>
          )}
          {clinic.email && (
            <div className="flex items-center gap-2">
              <EnvelopeIcon className="w-5 h-5 text-stone-600 flex-shrink-0" />
              <span className="text-stone-700 text-sm">{clinic.email}</span>
            </div>
          )}
        </div>

        {showActions && (onEdit || onDelete) && (
          <div className="flex gap-2 pt-4 border-t-4 border-stone-900">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(clinic.clinicId)
                }}
                className="btn-brutal-outline flex-1"
              >
                Chỉnh sửa
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(clinic.clinicId)
                }}
                className="btn-brutal-outline flex-1 text-red-600 border-red-600 hover:bg-red-50"
              >
                Xóa
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

