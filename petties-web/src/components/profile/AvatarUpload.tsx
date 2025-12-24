import { useState, useRef, useEffect } from 'react'
import { UserCircleIcon, CameraIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import { ImageCropModal } from './ImageCropModal'

interface AvatarUploadProps {
  currentAvatar: string | null
  onUpload: (file: File) => Promise<void>
  onDelete: () => Promise<void>
  isLoading: boolean
  disabled?: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function AvatarUpload({
  currentAvatar,
  onUpload,
  onDelete,
  isLoading,
  disabled = false,
}: AvatarUploadProps) {
  const [error, setError] = useState<string | null>(null)
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now())
  const [isCropModalOpen, setIsCropModalOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update avatar version when currentAvatar changes (after upload/delete/refetch)
  useEffect(() => {
    if (currentAvatar) {
      setAvatarVersion(Date.now())
    }
  }, [currentAvatar])

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Chỉ hỗ trợ định dạng: JPEG, PNG, GIF, WEBP'
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Kích thước file tối đa là 10MB'
    }
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }

    // Read file and open crop modal
    const reader = new FileReader()
    reader.onloadend = () => {
      setSelectedImageSrc(reader.result as string)
      setIsCropModalOpen(true)
    }
    reader.readAsDataURL(file)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = async (croppedFile: File) => {
    try {
      await onUpload(croppedFile)
      // avatarVersion will be updated by useEffect when currentAvatar changes
      setIsCropModalOpen(false)
      setSelectedImageSrc(null)
    } catch {
      setError('Lỗi khi upload avatar')
    }
  }

  const handleCloseCropModal = () => {
    setIsCropModalOpen(false)
    setSelectedImageSrc(null)
  }

  const handleDelete = async () => {
    setError(null)
    try {
      await onDelete()
      // avatarVersion will be updated by useEffect when currentAvatar changes
    } catch {
      setError('Lỗi khi xóa avatar')
    }
  }

  const handleEditAvatar = () => {
    if (!currentAvatar) return

    // Open crop modal with current avatar
    setSelectedImageSrc(currentAvatar)
    setIsCropModalOpen(true)
  }

  const triggerFileInput = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Cache-busting: append version timestamp to avatar URL
  const displayImage = currentAvatar
    ? `${currentAvatar}?v=${avatarVersion}`
    : null

  return (
    <>
      <div className="flex flex-col items-center gap-4">
        {/* Avatar Display */}
        <div className="relative">
          <div className="w-32 h-32 border-4 border-stone-900 bg-stone-100 overflow-hidden shadow-brutal">
            {displayImage ? (
              <img
                src={displayImage}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserCircleIcon className="w-full h-full text-stone-400 p-4" />
            )}
            {isLoading && (
              <div className="absolute inset-0 bg-stone-900/50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent animate-spin" />
              </div>
            )}
          </div>

          {/* Upload Button */}
          {!disabled && (
            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isLoading}
              className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#f59e0b] border-4 border-stone-900 shadow-brutal flex items-center justify-center hover:bg-amber-400 transition-all active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CameraIcon className="w-5 h-5 text-stone-900" />
            </button>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled || isLoading}
        />

        {/* Edit & Delete Buttons */}
        {currentAvatar && !disabled && (
          <div className="flex flex-col gap-2 w-full">
            <button
              type="button"
              onClick={handleEditAvatar}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border-4 border-stone-900 font-bold text-stone-900 uppercase hover:bg-stone-100 transition-colors shadow-brutal active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PencilIcon className="w-4 h-4" />
              CHỈNH SỬA
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrashIcon className="w-4 h-4" />
              XÓA ẢNH ĐẠI DIỆN
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <p className="text-red-600 text-sm font-semibold">{error}</p>
        )}

        {/* File Requirements */}
        {!disabled && (
          <p className="text-stone-500 text-xs text-center">
            JPEG, PNG, GIF, WEBP - Tối đa 10MB
          </p>
        )}
      </div>

      {/* Image Crop Modal */}
      {selectedImageSrc && (
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={selectedImageSrc}
          onClose={handleCloseCropModal}
          onCropComplete={handleCropComplete}
          isLoading={isLoading}
        />
      )}
    </>
  )
}

export default AvatarUpload
