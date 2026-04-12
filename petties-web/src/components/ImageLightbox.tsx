import { useState, useEffect } from 'react'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

interface ImageItem {
    url: string
    description?: string
}

interface ImageLightboxProps {
    images: ImageItem[]
    initialIndex?: number
    isOpen: boolean
    onClose: () => void
}

export const ImageLightbox = ({
    images,
    initialIndex = 0,
    isOpen,
    onClose,
}: ImageLightboxProps) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex)

    useEffect(() => {
        setCurrentIndex(initialIndex)
    }, [initialIndex])

    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
            if (event.key === 'ArrowLeft') setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
            if (event.key === 'ArrowRight') setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose, images.length])

    const goToPrev = () => {
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
    }

    const goToNext = () => {
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
    }

    if (!isOpen || images.length === 0) return null

    const currentImage = images[currentIndex]

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-stone-900/90 backdrop-blur-md animate-fadeIn">
            <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-full border-2 border-white/30 bg-black/40 p-3 text-white transition-all hover:bg-black/60 hover:border-white/50 active:scale-95"
            >
                <XMarkIcon className="h-6 w-6" />
            </button>

            {images.length > 1 && (
                <button
                    type="button"
                    onClick={goToPrev}
                    className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-white/30 bg-black/40 p-3 text-white transition-all hover:bg-black/60 hover:border-white/50 active:scale-95"
                >
                    <ChevronLeftIcon className="h-6 w-6" />
                </button>
            )}

            {images.length > 1 && (
                <button
                    type="button"
                    onClick={goToNext}
                    className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border-2 border-white/30 bg-black/40 p-3 text-white transition-all hover:bg-black/60 hover:border-white/50 active:scale-95"
                >
                    <ChevronRightIcon className="h-6 w-6" />
                </button>
            )}

            <div 
                className="animate-scaleIn max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border-4 border-white/20 bg-black shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex max-h-[75vh] items-center justify-center bg-stone-950">
                    <img
                        src={currentImage.url}
                        alt={`Ảnh ${currentIndex + 1}`}
                        className="max-h-[75vh] w-auto max-w-full object-contain"
                    />
                </div>
                
                {currentImage.description && (
                    <div className="border-t-2 border-white/20 bg-stone-900 px-6 py-4">
                        <p className="text-sm font-semibold text-white">
                            {currentImage.description}
                        </p>
                        <p className="mt-1 text-xs text-stone-400">
                            Ảnh {currentIndex + 1} / {images.length}
                        </p>
                    </div>
                )}
            </div>

            <div className="absolute inset-0 -z-10" onClick={onClose} />
        </div>
    )
}

export default ImageLightbox
