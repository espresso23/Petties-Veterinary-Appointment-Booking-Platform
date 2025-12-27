import { useState, useRef, useEffect } from 'react'
import { clinicService } from '../../services/api/clinicService'
import type { ClinicImage, ClinicResponse } from '../../types/clinic'

interface ClinicImageUploadProps {
  clinicId: string
  initialImages?: ClinicImage[] | string[]
  onImageUploaded?: () => void
}

type ImageItem = {
  imageId?: string
  imageUrl: string
  isPrimary?: boolean
  caption?: string
  displayOrder?: number
}

const mapResponseImages = (resp?: ClinicResponse | null): ImageItem[] => {
  if (!resp) return []
  if (resp.imageDetails && resp.imageDetails.length > 0) {
    return resp.imageDetails.map((img) => ({
      imageId: img.imageId,
      imageUrl: img.imageUrl,
      isPrimary: img.isPrimary,
      caption: img.caption,
      displayOrder: img.displayOrder,
    }))
  }
  if (resp.images && resp.images.length > 0) {
    return resp.images.map((url) => ({
      imageUrl: typeof url === 'string' ? url : url.imageUrl,
      imageId: typeof url === 'string' ? undefined : url.imageId,
      isPrimary: typeof url === 'string' ? false : url.isPrimary,
    }))
  }
  return []
}

const mapInitialImages = (imgs?: ClinicImage[] | string[]): ImageItem[] => {
  if (!imgs) return []
  return imgs.map((img, idx) => {
    if (typeof img === 'string') {
      return { imageUrl: img, imageId: undefined, isPrimary: idx === 0 }
    }
    return {
      imageId: img.imageId,
      imageUrl: img.imageUrl,
      isPrimary: img.isPrimary,
      caption: img.caption,
      displayOrder: img.displayOrder,
    }
  })
}

export function ClinicImageUpload({ clinicId, initialImages = [], onImageUploaded }: ClinicImageUploadProps) {
  const [images, setImages] = useState<ImageItem[]>(mapInitialImages(initialImages))
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync images when initialImages changes (after refetch)
  useEffect(() => {
    setImages(mapInitialImages(initialImages))
  }, [initialImages])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError(null)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const response = await clinicService.uploadClinicImage(
          clinicId,
          file,
          undefined,
          undefined,
          images.length === 0 && i === 0, // First image is primary if no existing images
        )
        const mapped = mapResponseImages(response)
        if (mapped.length > 0) {
          setImages(mapped)
        }
      }
      // Callback to refetch clinic
      if (onImageUploaded) {
        onImageUploaded()
      }
    } catch (err: any) {
      console.error('Failed to upload image:', err)
      console.error('Error response:', err.response?.data)
      console.error('Error status:', err.response?.status)
      
      // Extract error message from response
      const errorMessage = err.response?.data?.message 
        || err.response?.data?.error 
        || err.message 
        || 'Không thể upload ảnh. Vui lòng thử lại.'
      
      setError(errorMessage)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (image: ImageItem) => {
    if (!image.imageId) return
    try {
      await clinicService.deleteClinicImage(clinicId, image.imageId)
      setImages((prev) => prev.filter((img) => img.imageId !== image.imageId))
      onImageUploaded?.()
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || 'Không thể xóa ảnh. Vui lòng thử lại.'
      setError(errorMessage)
    }
  }

  const handleSetPrimary = async (image: ImageItem) => {
    if (!image.imageId) return
    try {
      const resp = await clinicService.setPrimaryClinicImage(clinicId, image.imageId)
      const mapped = mapResponseImages(resp)
      if (mapped.length > 0) {
        setImages(mapped)
      }
      onImageUploaded?.()
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || err.message || 'Không thể đặt ảnh làm primary.'
      setError(errorMessage)
    }
  }

  return (
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
        {error && (
          <p className="text-red-600 text-sm mt-1 font-bold">{error}</p>
        )}
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div key={image.imageId || index} className="relative">
              <div className="card-brutal overflow-hidden aspect-square">
                <img
                  src={image.imageUrl}
                  alt={`Clinic image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {image.isPrimary && (
                <div className="absolute bottom-2 left-2 bg-amber-600 text-white font-bold uppercase text-xs px-2 py-1 border-2 border-stone-900 shadow-brutal">
                  PRIMARY
                </div>
              )}
              <div className="absolute top-2 right-2 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!image.imageId || image.isPrimary}
                  onClick={() => handleSetPrimary(image)}
                  className={`px-2 py-1 text-xs font-bold uppercase border-2 border-stone-900 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${
                    image.isPrimary ? 'opacity-60 cursor-default' : 'hover:bg-amber-50'
                  }`}
                >
                  Chọn làm chính
                </button>
                <button
                  type="button"
                  disabled={!image.imageId}
                  onClick={() => handleDelete(image)}
                  style={{ backgroundColor: 'rgb(255, 107, 53)' }}
                  className="px-2 py-1 text-xs font-bold uppercase border-2 border-stone-900 text-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:brightness-95"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="text-stone-500 text-sm font-bold uppercase text-center py-8 border-2 border-dashed border-stone-300">
          Chưa có ảnh nào. Click "UPLOAD ẢNH" để thêm ảnh.
        </div>
      )}
    </div>
  )
}

