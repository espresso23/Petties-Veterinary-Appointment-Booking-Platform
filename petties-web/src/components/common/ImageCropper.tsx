import { useState, useRef, useEffect } from 'react'
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/solid'

interface ImageCropperProps {
    imageUrl: string
    aspectRatio?: number // width / height, default 1
    onCancel: () => void
    onSave: (blob: Blob) => void
}

export function ImageCropper({ imageUrl, aspectRatio = 1, onCancel, onSave }: ImageCropperProps) {
    const [scale, setScale] = useState(1)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const imageRef = useRef<HTMLImageElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Reset state when image changes
    useEffect(() => {
        setScale(1)
        setPosition({ x: 0, y: 0 })
    }, [imageUrl])

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true)
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        })
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleSave = () => {
        if (!imageRef.current || !containerRef.current) return

        // Ensure image is loaded
        if (!imageRef.current.complete) return

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size to the container size (visible area)
        // For a logo, we usually want high quality, so let's use a fixed reasonable size like 500x500
        const outputSize = 500
        canvas.width = outputSize
        canvas.height = outputSize / aspectRatio

        // Clear background
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const containerRect = containerRef.current.getBoundingClientRect()
        const ratio = outputSize / containerRect.width

        const naturalWidth = imageRef.current.naturalWidth
        const naturalHeight = imageRef.current.naturalHeight

        ctx.save()

        // Center of canvas
        ctx.translate(canvas.width / 2, canvas.height / 2)

        // Apply user transformations
        // Scale
        ctx.scale(scale, scale)
        // Translate (scaled position)
        ctx.translate(position.x * ratio / scale, position.y * ratio / scale)

        // Draw image centered at origin
        ctx.drawImage(
            imageRef.current,
            -naturalWidth / 2 * ratio,
            -naturalHeight / 2 * ratio,
            naturalWidth * ratio,
            naturalHeight * ratio
        )

        ctx.restore()

        canvas.toBlob((blob) => {
            if (blob) onSave(blob)
        }, 'image/png', 1.0)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-[#FFFDF8] w-full max-w-lg shadow-[8px_8px_0px_#1c1917] border-4 border-stone-900 animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-stone-900 bg-stone-100">
                    <h3 className="text-lg font-black uppercase text-stone-900">Chỉnh sửa ảnh</h3>
                    <button onClick={onCancel} className="p-1 hover:bg-stone-200 rounded">
                        <XMarkIcon className="w-6 h-6 text-stone-900" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Viewport */}
                    <div
                        ref={containerRef}
                        className="relative w-full aspect-square bg-stone-800 overflow-hidden cursor-move border-2 border-stone-900"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <img
                            ref={imageRef}
                            src={imageUrl}
                            alt="Crop target"
                            className="absolute top-0 left-0 max-w-none origin-center pointer-events-none select-none"
                            style={{
                                top: '50%',
                                left: '50%',
                                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                            }}
                            draggable={false}
                        />
                        {/* Grid overlay for guidance */}
                        <div className="absolute inset-0 pointer-events-none opacity-30">
                            <div className="w-full h-1/3 border-b border-white"></div>
                            <div className="w-full h-1/3 border-b border-white top-2/3 absolute"></div>
                            <div className="h-full w-1/3 border-r border-white absolute top-0 left-0"></div>
                            <div className="h-full w-1/3 border-r border-white absolute top-0 left-2/3"></div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-6 space-y-4">
                        <div>
                            <label className="flex justify-between text-xs font-bold uppercase text-stone-600 mb-2">
                                <span>Thu nhỏ</span>
                                <span>Zoom: {Math.round(scale * 100)}%</span>
                                <span>Phóng to</span>
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="3"
                                step="0.1"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
                            />
                        </div>

                        <p className="text-xs text-stone-500 text-center">
                            Kéo ảnh để di chuyển • Sử dụng thanh trượt để phóng to/thu nhỏ
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t-4 border-stone-900 bg-stone-100 flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 text-sm font-bold uppercase border-2 border-stone-900 hover:bg-stone-200 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2 bg-amber-500 text-stone-900 text-sm font-bold uppercase border-2 border-stone-900 shadow-[3px_3px_0px_#1c1917] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_#1c1917] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                        <CheckIcon className="w-5 h-5" />
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    )
}
