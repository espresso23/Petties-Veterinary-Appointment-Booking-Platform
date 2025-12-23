import { useState, useRef, useEffect } from 'react'
import { clinicService } from '../../services/api/clinicService'

interface ClinicImageUploadProps {
  clinicId: string
  initialImages?: string[]
  onImageUploaded?: () => void
}

export function ClinicImageUpload({ clinicId, initialImages = [], onImageUploaded }: ClinicImageUploadProps) {
  const [images, setImages] = useState<string[]>(initialImages)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync images when initialImages changes (after refetch)
  useEffect(() => {
    setImages(initialImages)
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
        // Update images list from response
        if (response.images && response.images.length > 0) {
          setImages(response.images)
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
          {images.map((imageUrl, index) => (
            <div key={index} className="relative group">
              <div className="card-brutal overflow-hidden aspect-square">
                <img
                  src={imageUrl}
                  alt={`Clinic image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {index === 0 && (
                <div className="absolute bottom-2 left-2 bg-amber-600 text-white font-bold uppercase text-xs px-2 py-1 border-2 border-stone-900 shadow-brutal">
                  PRIMARY
                </div>
              )}
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

