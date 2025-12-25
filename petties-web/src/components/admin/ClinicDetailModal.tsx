import { XMarkIcon } from '@heroicons/react/24/outline'
import type { ClinicResponse } from '../../types/clinic'

interface ClinicDetailModalProps {
  isOpen: boolean
  onClose: () => void
  clinic: ClinicResponse
}

/**
 * Clinic Detail Modal - Neobrutalism Design
 * Shows full clinic information for admin review
 */
export const ClinicDetailModal = ({ isOpen, onClose, clinic }: ClinicDetailModalProps) => {
  if (!isOpen) return null

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatOperatingHours = () => {
    if (!clinic.operatingHours) return 'Chưa cập nhật'
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    const dayNames: Record<string, string> = {
      MONDAY: 'Thứ 2',
      TUESDAY: 'Thứ 3',
      WEDNESDAY: 'Thứ 4',
      THURSDAY: 'Thứ 5',
      FRIDAY: 'Thứ 6',
      SATURDAY: 'Thứ 7',
      SUNDAY: 'Chủ nhật',
    }
    return days
      .map((day) => {
        const hours = clinic.operatingHours?.[day]
        if (!hours) return null
        if (hours.isClosed) return `${dayNames[day]}: Đóng cửa`
        return `${dayNames[day]}: ${hours.openTime || 'N/A'} - ${hours.closeTime || 'N/A'}`
      })
      .filter(Boolean)
      .join('\n')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div
        className="relative w-full max-w-4xl bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black p-6 bg-amber-500">
          <h2 className="text-2xl font-black uppercase text-black">
            Chi tiết phòng khám
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-black text-white border-2 border-black hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.4)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Basic Info */}
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Thông tin cơ bản</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Tên phòng khám</label>
                <p className="text-base font-bold text-black mt-1">{clinic.name}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Số điện thoại</label>
                <p className="text-base font-bold text-black mt-1">{clinic.phone}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Email</label>
                <p className="text-base font-bold text-black mt-1">{clinic.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Trạng thái</label>
                <p className="text-base font-bold text-black mt-1 uppercase">{clinic.status}</p>
              </div>
            </div>
            {clinic.description && (
              <div className="mt-4">
                <label className="text-xs font-bold uppercase text-stone-600">Mô tả</label>
                <p className="text-sm font-bold text-black mt-1 whitespace-pre-wrap">{clinic.description}</p>
              </div>
            )}
          </div>

          {/* Owner Info */}
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Chủ sở hữu</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Tên</label>
                <p className="text-base font-bold text-black mt-1">
                  {clinic.owner?.fullName || clinic.owner?.username || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Email</label>
                <p className="text-base font-bold text-black mt-1">{clinic.owner?.email || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Địa chỉ</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Địa chỉ</label>
                <p className="text-base font-bold text-black mt-1">{clinic.address}</p>
              </div>
              {(clinic.district || clinic.province) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clinic.district && (
                    <div>
                      <label className="text-xs font-bold uppercase text-stone-600">Quận/Huyện</label>
                      <p className="text-base font-bold text-black mt-1">{clinic.district}</p>
                    </div>
                  )}
                  {clinic.province && (
                    <div>
                      <label className="text-xs font-bold uppercase text-stone-600">Tỉnh/Thành phố</label>
                      <p className="text-base font-bold text-black mt-1">{clinic.province}</p>
                    </div>
                  )}
                </div>
              )}
              {clinic.specificLocation && (
                <div>
                  <label className="text-xs font-bold uppercase text-stone-600">Vị trí cụ thể</label>
                  <p className="text-base font-bold text-black mt-1">{clinic.specificLocation}</p>
                </div>
              )}
              {(clinic.latitude && clinic.longitude) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-stone-600">Vĩ độ</label>
                    <p className="text-base font-bold text-black mt-1">{clinic.latitude}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-stone-600">Kinh độ</label>
                    <p className="text-base font-bold text-black mt-1">{clinic.longitude}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Operating Hours */}
          {clinic.operatingHours && (
            <div className="border-4 border-black p-4 bg-stone-50">
              <h3 className="text-lg font-black uppercase text-black mb-4">Giờ hoạt động</h3>
              <pre className="text-sm font-bold text-black whitespace-pre-wrap">{formatOperatingHours()}</pre>
            </div>
          )}

          {/* Images */}
          {clinic.images && clinic.images.length > 0 && (
            <div className="border-4 border-black p-4 bg-stone-50">
              <h3 className="text-lg font-black uppercase text-black mb-4">Hình ảnh ({clinic.images.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {clinic.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={typeof img === 'string' ? img : img.imageUrl}
                    alt={`Clinic image ${idx + 1}`}
                    className="w-full h-32 object-cover border-2 border-black"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Thông tin thời gian</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Ngày tạo</label>
                <p className="text-base font-bold text-black mt-1">{formatDate(clinic.createdAt)}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Ngày cập nhật</label>
                <p className="text-base font-bold text-black mt-1">{formatDate(clinic.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-4 border-black p-4 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white text-black font-black uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

