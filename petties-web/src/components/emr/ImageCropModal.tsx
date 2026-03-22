import { useState, useRef, useCallback } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import { XMarkIcon } from '@heroicons/react/24/outline'
import 'react-image-crop/dist/ReactCrop.css'

interface ImageCropModalProps {
    isOpen: boolean
    onClose: () => void
    imageUrl: string
    onCropComplete: (croppedFile: File) => void
}

export function ImageCropModal({
    isOpen,
    onClose,
    imageUrl,
    onCropComplete,
}: ImageCropModalProps) {
    const [crop, setCrop] = useState<Crop>()
    const imgRef = useRef<HTMLImageElement>(null)

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget
        const size = Math.min(naturalWidth, naturalHeight)
        setCrop({
            unit: '%',
            x: 50 - (size / naturalWidth) * 50,
            y: 50 - (size / naturalHeight) * 50,
            width: (size / naturalWidth) * 100,
            height: (size / naturalHeight) * 100,
        })
    }, [])

    const getCroppedImage = useCallback(async (): Promise<File | null> => {
        if (!imgRef.current || !crop) return null

        const image = imgRef.current
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        const scaleX = image.naturalWidth / image.width
        const scaleY = image.naturalHeight / image.height

        const pixelCrop: PixelCrop = {
            unit: 'px',
            x: crop.x * scaleX,
            y: crop.y * scaleY,
            width: crop.width * scaleX,
            height: crop.height * scaleY,
        }

        canvas.width = pixelCrop.width
        canvas.height = pixelCrop.height

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height,
        )

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(null)
                        return
                    }
                    const file = new File([blob], 'cropped-image.jpg', {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    })
                    resolve(file)
                },
                'image/jpeg',
                0.9,
            )
        })
    }, [crop])

    const handleApply = async () => {
        const file = await getCroppedImage()
        if (file) {
            onCropComplete(file)
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white border-4 border-black shadow-[8px_8px_0_#1c1917] w-full max-w-2xl max-h-[90vh] overflow-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-black">
                    <h3 className="text-lg font-black uppercase">Crop Ảnh</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Crop Area */}
                <div className="p-4">
                    <div className="flex justify-center mb-4">
                        <ReactCrop
                            crop={crop}
                            onChange={(c) => setCrop(c)}
                            keepSelection
                            className="max-h-[60vh] border-4 border-black"
                        >
                            <img
                                ref={imgRef}
                                src={imageUrl}
                                alt="Crop preview"
                                onLoad={onImageLoad}
                                className="max-h-[60vh] object-contain"
                            />
                        </ReactCrop>
                    </div>

                    <p className="text-sm text-stone-600 mb-4 text-center">
                        Kéo để chọn vùng bệnh lý cần phân tích
                    </p>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 border-4 border-black font-bold uppercase text-sm hover:bg-stone-100 transition-colors cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleApply}
                            disabled={!crop}
                            className="px-6 py-3 bg-amber-500 border-4 border-black font-bold uppercase text-sm text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            Áp dụng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
