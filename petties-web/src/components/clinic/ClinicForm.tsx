import { useState } from 'react'
import type { ClinicRequest, OperatingHours, ClinicImage } from '../../types/clinic'
import { AddressAutocompleteOSM } from './AddressAutocompleteOSM'
import { ClinicImageUpload } from './ClinicImageUpload'
import { ClinicLogoUpload } from './ClinicLogoUpload'
import { DocumentDuplicateIcon, DocumentTextIcon, ArrowUpTrayIcon } from '@heroicons/react/24/solid'
import { LocationSelector } from '../common'
import { uploadBusinessLicense } from '../../services/endpoints/file'
import { useToast } from '../Toast'

interface ClinicFormProps {
  initialData?: Partial<ClinicRequest>
  clinicId?: string // For uploading images after clinic is created
  initialImages?: ClinicImage[] // Existing images with imageId for setPrimary
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
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'THỨ HAI',
  TUESDAY: 'THỨ BA',
  WEDNESDAY: 'THỨ TƯ',
  THURSDAY: 'THỨ NĂM',
  FRIDAY: 'THỨ SÁU',
  SATURDAY: 'THỨ BẢY',
  SUNDAY: 'CHỦ NHẬT',
}

export function ClinicForm({
  initialData,
  clinicId,
  initialImages = [],
  onSubmit,
  onCancel,
  isLoading = false,
  onImageUploaded,
}: ClinicFormProps) {
  const { showToast } = useToast()
  const [formData, setFormData] = useState<ClinicRequest>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    address: initialData?.address || '',
    ward: initialData?.ward || '',
    district: initialData?.district || '',
    province: initialData?.province || '',
    specificLocation: initialData?.specificLocation || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    operatingHours: initialData?.operatingHours || {},
    latitude: initialData?.latitude,
    longitude: initialData?.longitude,
    logo: initialData?.logo,
    businessLicenseUrl: initialData?.businessLicenseUrl || '',
  })

  const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(null)
  const [businessLicensePreview, setBusinessLicensePreview] = useState<string>(initialData?.businessLicenseUrl || '')
  const [showLicensePreview, setShowLicensePreview] = useState(false)
  const [isUploadingLicense, setIsUploadingLicense] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const handleApplyToAll = (sourceDay: string) => {
    const sourceHours = formData.operatingHours?.[sourceDay];
    if (!sourceHours) return;

    setFormData((prev) => {
      const newHours: Record<string, OperatingHours> = {};
      DAYS_OF_WEEK.forEach((day) => {
        newHours[day] = { ...sourceHours };
      });
      return { ...prev, operatingHours: newHours };
    });
  };

  const handleBusinessLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
      if (!validTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, businessLicense: 'Chỉ chấp nhận file PDF, JPG, hoặc PNG' }))
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, businessLicense: 'Kích thước file không được vượt quá 5MB' }))
        return
      }

      setBusinessLicenseFile(file)

      // Create Data URL for image preview
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setBusinessLicensePreview(reader.result as string)
        }
        reader.readAsDataURL(file)
      } else {
        // For non-image files (PDF), just show filename
        setBusinessLicensePreview(file.name)
      }

      // Clear error if any
      if (errors.businessLicense) {
        setErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors.businessLicense
          return newErrors
        })
      }
    }
  }

  const handleRemoveBusinessLicense = () => {
    setBusinessLicenseFile(null)
    setBusinessLicensePreview('')
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    const missingFields: string[] = []

    if (!formData.name.trim()) {
      newErrors.name = 'Tên phòng khám không được để trống'
      missingFields.push('Tên phòng khám')
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Địa chỉ không được để trống'
      missingFields.push('Địa chỉ')
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'Số điện thoại không được để trống'
      missingFields.push('Số điện thoại')
    }
    if (!businessLicenseFile && !initialData?.businessLicenseUrl) {
      newErrors.businessLicense = 'Giấy phép kinh doanh là bắt buộc'
      missingFields.push('Giấy phép kinh doanh')
    }
    if (formData.phone && !/^0\d{9,10}$/.test(formData.phone)) {
      newErrors.phone = 'Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)'
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ'
    }

    setErrors(newErrors)

    // Show toast if there are missing required fields
    if (missingFields.length > 0) {
      showToast('error', `Vui lòng điền đầy đủ các trường bắt buộc: ${missingFields.join(', ')}`)
    }

    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    try {
      let finalFormData = { ...formData }

      // Upload business license file if selected
      if (businessLicenseFile) {
        setIsUploadingLicense(true)
        try {
          const uploadResult = await uploadBusinessLicense(businessLicenseFile)
          finalFormData.businessLicenseUrl = uploadResult.url
        } catch (uploadError) {
          setErrors(prev => ({
            ...prev,
            businessLicense: 'Không thể tải lên giấy phép. Vui lòng thử lại.'
          }))
          setIsUploadingLicense(false)
          return
        }
        setIsUploadingLicense(false)
      }

      await onSubmit(finalFormData)
    } catch (error) {
      // Error handled by parent
    }
  }

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
                    ward: place.ward || prev.ward,
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

          <LocationSelector
            provinceValue={formData.province}
            districtValue={formData.district}
            wardValue={formData.ward}
            onLocationChange={(loc) => {
              setFormData((prev) => ({
                ...prev,
                province: loc.province || '',
                district: loc.district || '',
                ward: loc.ward || '',
              }))
            }}
          />

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

          {/* Business License Upload */}
          <div>
            <label className="block text-sm font-bold uppercase text-stone-900 mb-2">
              <DocumentTextIcon className="inline-block w-5 h-5 mr-2 text-stone-900" />
              Giấy phép kinh doanh *
            </label>

            {!businessLicenseFile && !businessLicensePreview ? (
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleBusinessLicenseChange}
                  className="hidden"
                  id="business-license-upload"
                />
                <label
                  htmlFor="business-license-upload"
                  className="flex items-center justify-center gap-3 w-full px-6 py-4 bg-amber-50 border-2 border-stone-900 shadow-[4px_4px_0px_#1c1917] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_#1c1917] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all cursor-pointer"
                >
                  <ArrowUpTrayIcon className="w-6 h-6 text-stone-900" />
                  <span className="text-sm font-bold text-stone-900">
                    CHỌN FILE (PDF, JPG, PNG - Max 5MB)
                  </span>
                </label>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border-2 border-green-600 shadow-[3px_3px_0px_#16a34a]">
                  <DocumentTextIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-bold text-green-800 flex-1 truncate">
                    {businessLicenseFile?.name || 'Đã tải lên'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveBusinessLicense}
                    className="px-3 py-1 bg-red-600 text-white text-xs font-bold uppercase border-2 border-red-800 shadow-[2px_2px_0px_#991b1b] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#991b1b] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    XÓA
                  </button>
                </div>
                {/* Image Preview */}
                {businessLicensePreview && (businessLicensePreview.startsWith('data:image') || businessLicensePreview.startsWith('http')) && (
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase text-stone-700 mb-2">XEM TRƯỚC:</p>
                    <img
                      src={businessLicensePreview}
                      alt="Xem trước giấy phép kinh doanh"
                      className="max-h-64 border-2 border-stone-900 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setShowLicensePreview(true)}
                    />
                    <p className="text-xs text-stone-500 mt-1">Click vào ảnh để xem lớn hơn</p>
                  </div>
                )}
              </div>
            )}

            {errors.businessLicense && (
              <p className="text-red-600 text-sm mt-1 font-bold">{errors.businessLicense}</p>
            )}
            <p className="text-xs text-stone-500 mt-1">
              Giấy phép kinh doanh là bắt buộc để phòng khám được duyệt
            </p>
          </div>
        </div>
      </div>

      {/* License Preview Modal */}
      {showLicensePreview && businessLicensePreview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowLicensePreview(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto">
            <img
              src={businessLicensePreview}
              alt="Giấy phép kinh doanh"
              className="max-w-full max-h-[85vh] object-contain border-4 border-white rounded-lg"
            />
            <button
              type="button"
              onClick={() => setShowLicensePreview(false)}
              className="absolute top-2 right-2 w-10 h-10 bg-white border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#1c1917] flex items-center justify-center font-bold text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
          <ClinicImageUpload
            clinicId={clinicId}
            initialImages={initialImages}
            onImageUploaded={onImageUploaded}
          />
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
                    {DAY_LABELS[day]}
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
                    <span className="text-sm font-bold uppercase text-stone-700">ĐÓNG CỬA</span>
                  </label>
                </div>

                {!hours.isClosed && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                          GIỜ MỞ CỬA
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
                          GIỜ ĐÓNG CỬA
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

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-stone-200">
                      <div>
                        <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                          NGHỈ TRƯA (BẮT ĐẦU)
                        </label>
                        <input
                          type="time"
                          value={hours.breakStart || ''}
                          onChange={(e) =>
                            handleOperatingHoursChange(day, 'breakStart', e.target.value)
                          }
                          className="input-brutal bg-stone-50"
                          placeholder="Optional"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-stone-600 mb-1">
                          NGHỈ TRƯA (KẾT THÚC)
                        </label>
                        <input
                          type="time"
                          value={hours.breakEnd || ''}
                          onChange={(e) =>
                            handleOperatingHoursChange(day, 'breakEnd', e.target.value)
                          }
                          className="input-brutal bg-stone-50"
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyToAll(day)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-900 text-white text-[10px] font-bold uppercase border-2 border-stone-900 shadow-[2px_2px_0px_#1c1917] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                    >
                      <DocumentDuplicateIcon className="w-3.5 h-3.5 text-white" />
                      Áp dụng cho mọi ngày
                    </button>
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
          disabled={isLoading || isUploadingLicense}
          className="btn-brutal flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploadingLicense ? 'ĐANG TẢI GIẤY PHÉP...' : isLoading ? 'ĐANG LƯU...' : 'LƯU'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading || isUploadingLicense}
            className="btn-brutal-outline flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            HỦY
          </button>
        )}
      </div>
    </form>
  )
}

