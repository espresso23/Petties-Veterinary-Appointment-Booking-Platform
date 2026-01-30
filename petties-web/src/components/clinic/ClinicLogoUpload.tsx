import { useState, useRef } from 'react'
import { clinicService } from '../../services/api/clinicService'
import { ClinicLogoDisplay } from './ClinicLogoDisplay'
import { ImageCropper } from '../common/ImageCropper'

interface ClinicLogoUploadProps {
  clinicId: string
  currentLogo?: string
  onLogoUploaded?: (logoUrl: string) => void
}

export function ClinicLogoUpload({ clinicId, currentLogo, onLogoUploaded }: ClinicLogoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoUrl, setLogoUrl] = useState<string | undefined>(currentLogo)

  // Cropper state
  const [showCropper, setShowCropper] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước file không được vượt quá 5MB')
      return
    }

    // Read file as Data URL for preview/cropper
    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage(reader.result as string)
      setShowCropper(true)
      // Reset file input so same file can be selected again if cancelled
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  const handleCropSave = async (blob: Blob) => {
    setShowCropper(false)
    setUploading(true)
    setError(null)

    // Convert blob to file
    const file = new File([blob], "logo-cropped.png", { type: "image/png" })

    try {
      const response = await clinicService.uploadClinicLogo(clinicId, file)
      if (response.logo) {
        // Appending timestamp to force image refresh (cache busting)
        const newLogoUrl = `${response.logo}?t=${new Date().getTime()}`
        setLogoUrl(newLogoUrl)
        if (onLogoUploaded) {
          onLogoUploaded(newLogoUrl)
        }
      }
    } catch (err: any) {
      console.error('Failed to upload logo:', err)
      const errorMessage = err.response?.data?.message || err.message || 'Không thể upload logo. Vui lòng thử lại.'
      setError(errorMessage)
    } finally {
      setUploading(false)
    }
  }

  const handleCropCancel = () => {
    setShowCropper(false)
    setSelectedImage(null)
  }

  return (
    <div className="space-y-2">
      {/* Logo Preview */}
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24 border-4 border-stone-900 bg-white flex items-center justify-center overflow-hidden">
          <ClinicLogoDisplay logoUrl={logoUrl} alt="Clinic Logo" size="lg" />
        </div>
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
            id={`logo-upload-${clinicId}`}
          />
          <label
            htmlFor={`logo-upload-${clinicId}`}
            className={`btn-brutal inline-block cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {uploading ? 'ĐANG TẢI LÊN...' : 'CHỌN LOGO'}
          </label>
          <p className="text-xs text-stone-500 mt-1">
            {logoUrl ? 'Logo đã được tải lên' : 'Chưa có logo, sẽ sử dụng logo mặc định'}
          </p>
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm font-bold">{error}</p>
      )}

      {/* Cropper Modal */}
      {showCropper && selectedImage && (
        <ImageCropper
          imageUrl={selectedImage}
          aspectRatio={1} // Square logo
          onCancel={handleCropCancel}
          onSave={handleCropSave}
        />
      )}
    </div>
  )
}

