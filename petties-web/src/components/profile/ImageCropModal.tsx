import { useState, useCallback, useRef } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useToast } from '../Toast'

interface ImageCropModalProps {
  isOpen: boolean
  imageSrc: string
  onClose: () => void
  onCropComplete: (croppedFile: File) => Promise<void>
  isLoading: boolean
}

const TARGET_SIZE = 512 // Resize to 512x512px

/**
 * Create cropped and resized image from crop area
 */
const createCroppedImage = async (
  imageSrc: string,
  croppedAreaPixels: Area,
  targetSize: number
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image()

    // IMPORTANT: Set crossOrigin before setting src to avoid CORS tainted canvas
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }

        // Set canvas to target size (512x512)
        canvas.width = targetSize
        canvas.height = targetSize

        // Draw cropped area and resize to target size
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          targetSize,
          targetSize
        )

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob conversion failed'))
            return
          }
          resolve(blob)
        }, 'image/jpeg', 0.95) // JPEG with 95% quality
      } catch (error) {
        reject(error)
      }
    }

    image.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    // Set src AFTER crossOrigin
    image.src = imageSrc
  })
}

export function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  isLoading,
}: ImageCropModalProps) {
  const { showToast } = useToast()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isAspectLocked, setIsAspectLocked] = useState(true)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isCropping, setIsCropping] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    []
  )

  const handleCropAndUpload = async () => {
    if (!croppedAreaPixels) return

    setIsCropping(true)
    try {
      const croppedBlob = await createCroppedImage(
        imageSrc,
        croppedAreaPixels,
        TARGET_SIZE
      )

      // Convert Blob to File
      const croppedFile = new File(
        [croppedBlob],
        `avatar_${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      )

      await onCropComplete(croppedFile)
      onClose()
    } catch (error) {
      console.error('Crop failed:', error)
      showToast('error', 'Lỗi khi crop ảnh. Vui lòng thử lại.')
    } finally {
      setIsCropping(false)
    }
  }

  const handleClose = () => {
    if (!isLoading && !isCropping) {
      onClose()
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === modalRef.current) {
      handleClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/80 p-4 overflow-y-auto"
    >
      <div className="w-full max-w-4xl my-auto bg-white border-4 border-stone-900 shadow-[8px_8px_0_#1c1917] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-4 border-stone-900 bg-amber-100 flex-shrink-0">
          <h2 className="text-xl font-bold uppercase text-stone-900">
            CROP ẢNH ĐẠI DIỆN
          </h2>
          <button
            onClick={handleClose}
            disabled={isLoading || isCropping}
            className="w-10 h-10 bg-white border-4 border-stone-900 flex items-center justify-center hover:bg-stone-100 transition-colors shadow-[2px_2px_0_#1c1917] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XMarkIcon className="w-6 h-6 text-stone-900" />
          </button>
        </div>

        {/* Crop Area */}
        <div className="relative w-full bg-stone-100 flex-shrink-0" style={{ height: 'min(500px, 50vh)' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={isAspectLocked ? 1 : undefined}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            cropShape="rect"
            showGrid={true}
            style={{
              containerStyle: {
                backgroundColor: '#f5f5f4',
              },
              cropAreaStyle: {
                border: '4px dashed #1c1917',
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="p-6 border-t-4 border-stone-900 space-y-4 overflow-y-auto flex-shrink-0">
          {/* Aspect Ratio Toggle */}
          <div className="flex items-center justify-between p-4 bg-stone-100 border-2 border-stone-900">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAspectLocked}
                onChange={(e) => setIsAspectLocked(e.target.checked)}
                className="w-6 h-6 border-4 border-stone-900 bg-white checked:bg-amber-400 appearance-none cursor-pointer relative
                  before:content-[''] before:absolute before:inset-0 before:bg-stone-900 before:scale-0 checked:before:scale-50 before:transition-transform"
              />
              <span className="font-bold text-stone-900 uppercase select-none">
                {isAspectLocked ? 'KHÓA TỶ LỆ 1:1' : 'CROP TỰ DO'}
              </span>
            </label>
          </div>

          {/* Zoom Slider */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-stone-900 uppercase">
              ZOOM: {Math.round(zoom * 100)}%
            </label>
            <div className="relative">
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-3 bg-stone-200 border-4 border-stone-900 appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:w-6
                  [&::-webkit-slider-thumb]:h-6
                  [&::-webkit-slider-thumb]:bg-amber-400
                  [&::-webkit-slider-thumb]:border-4
                  [&::-webkit-slider-thumb]:border-stone-900
                  [&::-webkit-slider-thumb]:cursor-pointer
                  [&::-moz-range-thumb]:w-6
                  [&::-moz-range-thumb]:h-6
                  [&::-moz-range-thumb]:bg-amber-400
                  [&::-moz-range-thumb]:border-4
                  [&::-moz-range-thumb]:border-stone-900
                  [&::-moz-range-thumb]:cursor-pointer"
              />
            </div>
          </div>

          {/* Info */}
          <div className="p-3 bg-amber-50 border-2 border-amber-400">
            <p className="text-sm font-semibold text-stone-700">
              Ảnh sẽ được tự động resize về 512x512px để tối ưu dung lượng
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-2">
            <button
              onClick={handleClose}
              disabled={isLoading || isCropping}
              className="flex-1 px-6 py-3 bg-white border-4 border-stone-900 font-bold uppercase text-stone-900 hover:bg-stone-100 transition-colors shadow-[4px_4px_0_#1c1917] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              HỦY
            </button>
            <button
              onClick={handleCropAndUpload}
              disabled={isLoading || isCropping || !croppedAreaPixels}
              className="flex-1 px-6 py-3 bg-[#f59e0b] border-4 border-stone-900 font-bold uppercase text-stone-900 hover:bg-amber-400 transition-colors shadow-[4px_4px_0_#1c1917] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCropping || isLoading ? 'ĐANG XỬ LÝ...' : 'CROP & UPLOAD'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageCropModal
