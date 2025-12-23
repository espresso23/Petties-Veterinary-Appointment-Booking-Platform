import { useState, useRef } from 'react'
import type { ClinicRequest, OperatingHours } from '../../types/clinic'
import { AddressAutocompleteOSM } from './AddressAutocompleteOSM'
import { clinicService } from '../../services/api/clinicService'
import { ClinicImageUpload } from './ClinicImageUpload'
import { ClinicLogoUpload } from './ClinicLogoUpload'

interface ClinicFormProps {
  initialData?: Partial<ClinicRequest>
  clinicId?: string // For uploading images after clinic is created
  initialImages?: string[] // Existing images URLs
  onSubmit: (data: ClinicRequest) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  onImageUploaded?: () => void // Callback to refetch clinic after image upload
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

export function ClinicForm({
  initialData,
  clinicId,
  initialImages = [],
  onSubmit,
  onCancel,
  isLoading = false,
  onImageUploaded,
}: ClinicFormProps) {
  const [formData, setFormData] = useState<ClinicRequest>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    address: initialData?.address || '',
    district: initialData?.district || '',
    province: initialData?.province || '',
    specificLocation: initialData?.specificLocation || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    operatingHours: initialData?.operatingHours || {},
    latitude: initialData?.latitude,
    longitude: initialData?.longitude,
    logo: initialData?.logo,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (field: keyof ClinicRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const handleOperatingHoursChange = (
    day: string,
    field: keyof OperatingHours,
    value: string | boolean,
  ) => {
    setFormData((prev) => {
      const hours = { ...prev.operatingHours }
      if (!hours[day]) {
        hours[day] = { isClosed: false }
      }
      hours[day] = { ...hours[day], [field]: value }
      return { ...prev, operatingHours: hours }
    })
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Tên phòng khám không được để trống'
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Địa chỉ không được để trống'
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Số điện thoại không được để trống'
    }
    if (formData.phone && !/^0\d{9,10}$/.test(formData.phone)) {
      newErrors.phone = 'Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)'
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !clinicId) return

    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        await clinicService.uploadClinicImage(
          clinicId,
          file,
          undefined,
          undefined,
          initialImages.length === 0 && i === 0, // First image is primary if no existing images
        )
      }
      // Refetch clinic to get updated images list
      if (onImageUploaded) {
        onImageUploaded()
      }
    } catch (error: any) {
      console.error('Failed to upload image:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      
      // Extract error message from response
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Không thể upload ảnh. Vui lòng thử lại.'
      
      setErrors((prev) => ({ ...prev, images: errorMessage }))
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteImage = async (imageUrl: string) => {
    if (!clinicId) return

    // Note: We need imageId to delete, but backend only returns URLs
    // For now, we'll need to find imageId by matching URL
    // This is a limitation - ideally backend should return imageId in response
    // For now, we'll show a message that deletion requires page refresh
    alert('Để xóa ảnh, vui lòng tải lại trang và sử dụng chức năng xóa trong trang chi tiết clinic.')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    try {
      await onSubmit(formData)
    } catch (error) {
      // Error handled by parent
    }
  }

  const allImages = initialImages

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="card-brutal p-6">
        <h3 className="text-lg font-bold uppercase text-stone-900 mb-4">THÔNG TIN CƠ BẢN</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
              Tên Phòng Khám *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="input-brutal"
              placeholder="Nhập tên phòng khám"
              maxLength={200}
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1 font-bold">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
              Mô Tả
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="input-brutal min-h-[100px] resize-y"
              placeholder="Mô tả về phòng khám"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
              Địa Chỉ *
            </label>
            <AddressAutocompleteOSM
              value={formData.address}
              onChange={(address) => handleChange('address', address)}
              onPlaceSelect={(place) => {
                if (place.latitude && place.longitude) {
                  setFormData((prev) => ({
                    ...prev,
                    address: place.address,
                    latitude: place.latitude,
                    longitude: place.longitude,
                    district: place.district || prev.district,
                    province: place.province || prev.province,
                  }))
                }
              }}
              placeholder="Nhập địa chỉ đầy đủ"
            />
            {errors.address && (
              <p className="text-red-600 text-sm mt-1 font-bold">{errors.address}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
              Vị Trí Chính Xác
            </label>
            <input
              type="text"
              value={formData.specificLocation || ''}
              onChange={(e) => handleChange('specificLocation', e.target.value)}
              className="input-brutal"
              placeholder="Ví dụ: Tầng 2, Khu phố 3, Số nhà 123, Tòa nhà ABC"
              maxLength={200}
            />
            <p className="text-xs text-stone-500 mt-1">
              Thông tin chi tiết như tầng lầu, khu phố, số nhà, tòa nhà, etc.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
                Số Điện Thoại *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="input-brutal"
                placeholder="0901234567"
                maxLength={20}
              />
              {errors.phone && (
                <p className="text-red-600 text-sm mt-1 font-bold">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="input-brutal"
                placeholder="contact@clinic.com"
                maxLength={100}
              />
              {errors.email && (
                <p className="text-red-600 text-sm mt-1 font-bold">{errors.email}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Logo Upload - Only show if clinicId exists (edit mode or after creation) */}
      {clinicId && (
        <div className="card-brutal p-6">
          <h3 className="text-lg font-bold uppercase text-stone-900 mb-4">LOGO PHÒNG KHÁM</h3>
          <ClinicLogoUpload
            clinicId={clinicId}
            currentLogo={formData.logo}
            onLogoUploaded={(logoUrl) => {
              setFormData((prev) => ({ ...prev, logo: logoUrl }))
              if (onImageUploaded) {
                onImageUploaded()
              }
            }}
          />
        </div>
      )}

      {/* Images Upload - Only show if clinicId exists (edit mode or after creation) */}
      {clinicId && (
        <div className="card-brutal p-6">
          <h3 className="text-lg font-bold uppercase text-stone-900 mb-4">ẢNH PHÒNG KHÁM</h3>

          <div className="space-y-4">
            {/* Upload Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
                id="clinic-image-upload"
              />
              <label
                htmlFor="clinic-image-upload"
                className={`btn-brutal-outline cursor-pointer inline-block ${
                  uploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploading ? 'UPLOADING...' : '+ UPLOAD ẢNH'}
              </label>
              {errors.images && (
                <p className="text-red-600 text-sm mt-1 font-bold">{errors.images}</p>
              )}
            </div>

            {/* Image Preview Grid */}
            {allImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {allImages.map((imageUrl, index) => (
                  <div key={index} className="relative group">
                    <div className="card-brutal overflow-hidden aspect-square">
                      <img
                        src={imageUrl}
                        alt={`Clinic image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(imageUrl)}
                      className="absolute top-2 right-2 bg-red-600 text-white font-bold uppercase text-xs px-2 py-1 border-2 border-stone-900 shadow-brutal hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}

            {allImages.length === 0 && (
              <div className="text-stone-500 text-sm font-bold uppercase text-center py-8 border-2 border-dashed border-stone-300">
                Chưa có ảnh nào. Click "UPLOAD ẢNH" để thêm ảnh.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Operating Hours */}
      <div className="card-brutal p-6">
        <h3 className="text-lg font-bold uppercase text-stone-900 mb-4">GIỜ LÀM VIỆC</h3>

        {/* 24/7 Option */}
        <div className="mb-6 p-4 border-4 border-amber-600 bg-amber-50">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={
                DAYS_OF_WEEK.every((day) => {
                  const hours = formData.operatingHours?.[day]
                  return hours && !hours.isClosed && hours.openTime === '00:00' && hours.closeTime === '23:59'
                }) && DAYS_OF_WEEK.length > 0
              }
              onChange={(e) => {
                if (e.target.checked) {
                  // Set all days to 24/7 (00:00 - 23:59)
                  const newHours: Record<string, OperatingHours> = {}
                  DAYS_OF_WEEK.forEach((day) => {
                    newHours[day] = {
                      openTime: '00:00',
                      closeTime: '23:59',
                      isClosed: false,
                    }
                  })
                  setFormData((prev) => ({ ...prev, operatingHours: newHours }))
                } else {
                  // Reset to default hours
                  const newHours: Record<string, OperatingHours> = {}
                  DAYS_OF_WEEK.forEach((day) => {
                    newHours[day] = {
                      openTime: '08:00',
                      closeTime: '17:00',
                      isClosed: false,
                    }
                  })
                  setFormData((prev) => ({ ...prev, operatingHours: newHours }))
                }
              }}
              className="w-6 h-6 border-2 border-stone-900"
            />
            <div>
              <div className="text-base font-bold uppercase text-stone-900">MỞ 24/7</div>
              <div className="text-xs text-stone-600 font-bold uppercase">Tất cả các ngày: 00:00 - 23:59</div>
            </div>
          </label>
        </div>

        <div className="space-y-3">
          {DAYS_OF_WEEK.map((day) => {
            const hours = formData.operatingHours?.[day] || { isClosed: false }
            const is24h = !hours.isClosed && hours.openTime === '00:00' && hours.closeTime === '23:59'
            return (
              <div key={day} className="border-2 border-stone-900 p-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold uppercase text-stone-900">
                    {day}
                    {is24h && (
                      <span className="ml-2 text-xs bg-amber-600 text-white px-2 py-1 border-2 border-stone-900">
                        24/7
                      </span>
                    )}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hours.isClosed}
                      onChange={(e) =>
                        handleOperatingHoursChange(day, 'isClosed', e.target.checked)
                      }
                      className="w-5 h-5 border-2 border-stone-900"
                    />
                    <span className="text-sm font-bold uppercase text-stone-700">CLOSED</span>
                  </label>
                </div>

                {!hours.isClosed && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                        OPEN TIME
                      </label>
                      <input
                        type="time"
                        value={hours.openTime || '08:00'}
                        onChange={(e) =>
                          handleOperatingHoursChange(day, 'openTime', e.target.value)
                        }
                        className="input-brutal"
                        disabled={is24h}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                        CLOSE TIME
                      </label>
                      <input
                        type="time"
                        value={hours.closeTime || '17:00'}
                        onChange={(e) =>
                          handleOperatingHoursChange(day, 'closeTime', e.target.value)
                        }
                        className="input-brutal"
                        disabled={is24h}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className="btn-brutal flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'SAVING...' : 'SAVE'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-brutal-outline flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CANCEL
          </button>
        )}
      </div>
    </form>
  )
}

