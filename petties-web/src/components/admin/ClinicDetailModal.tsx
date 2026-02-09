import { useState, useEffect, useRef } from 'react'
import { XMarkIcon, ChevronLeftIcon, ChevronRightIcon, DocumentTextIcon, ArrowDownTrayIcon, MagnifyingGlassPlusIcon, MagnifyingGlassMinusIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline'
import type { ClinicResponse } from '../../types/clinic'
import { ClinicMapOSM } from '../clinic/ClinicMapOSM'

/**
 * ImageViewer Component - Neobrutalism Design
 * Shows image with zoom controls, fullscreen, and download
 */
const ImageViewer = ({ src, alt }: { src: string; alt: string }) => {
  const [zoom, setZoom] = useState(1)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const MIN_ZOOM = 0.5
  const MAX_ZOOM = 3

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, MAX_ZOOM))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, MIN_ZOOM))
  const handleResetZoom = () => setZoom(1)

  const handleDownload = async () => {
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `giay-phep-kinh-doanh-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch {
      window.open(src, '_blank')
    }
  }

  return (
    <>
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= MIN_ZOOM}
              className="w-9 h-9 flex items-center justify-center bg-white border-2 border-black shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Thu nhỏ"
            >
              <MagnifyingGlassMinusIcon className="w-5 h-5" />
            </button>
            <span className="font-bold text-sm min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= MAX_ZOOM}
              className="w-9 h-9 flex items-center justify-center bg-white border-2 border-black shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="Phóng to"
            >
              <MagnifyingGlassPlusIcon className="w-5 h-5" />
            </button>
            {zoom !== 1 && (
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-3 h-9 flex items-center justify-center bg-stone-100 border-2 border-black shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-xs font-bold"
              >
                RESET
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFullscreen(true)}
              className="h-9 px-3 flex items-center gap-2 bg-stone-100 border-2 border-black shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-xs font-bold uppercase"
              title="Xem toàn màn hình"
            >
              <ArrowsPointingOutIcon className="w-4 h-4" />
              Mở rộng
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="h-9 px-3 flex items-center gap-2 bg-amber-500 border-2 border-black shadow-[2px_2px_0_#000] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-xs font-bold uppercase"
              title="Tải xuống"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Tải về
            </button>
          </div>
        </div>

        {/* Image Container */}
        <div className="border-4 border-black bg-stone-100 overflow-auto max-h-[400px]">
          <div
            className="min-h-[200px] flex items-center justify-center p-4 transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
          >
            <img
              src={src}
              alt={alt}
              className="max-w-full h-auto object-contain"
            />
          </div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {showFullscreen && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowFullscreen(false)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              className="h-10 px-4 flex items-center gap-2 bg-amber-500 border-2 border-black shadow-[3px_3px_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all text-sm font-bold uppercase"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Tải về
            </button>
            <button
              type="button"
              onClick={() => setShowFullscreen(false)}
              className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black shadow-[3px_3px_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

interface ClinicDetailModalProps {
  isOpen: boolean
  onClose: () => void
  clinic: ClinicResponse
}

/**
 * Clinic Detail Modal - Neobrutalism Design
 * Shows full clinic information for admin review
 */
export const ClinicDetailModal = ({ isOpen, onClose, clinic }: ClinicDetailModalProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  if (!isOpen) return null

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatOperatingHours = () => {
    if (!clinic.operatingHours) return 'Chưa cập nhật'
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    const dayNames: Record<string, string> = {
      MONDAY: 'Thứ 2',
      TUESDAY: 'Thứ 3',
      WEDNESDAY: 'Thứ 4',
      THURSDAY: 'Thứ 5',
      FRIDAY: 'Thứ 6',
      SATURDAY: 'Thứ 7',
      SUNDAY: 'Chủ nhật',
    }
    return days
      .map((day) => {
        const hours = clinic.operatingHours?.[day]
        if (!hours) return null
        if (hours.isClosed) return `${dayNames[day]}: Đóng cửa`
        return `${dayNames[day]}: ${hours.openTime || 'N/A'} - ${hours.closeTime || 'N/A'}`
      })
      .filter(Boolean)
      .join('\n')
  }

  // Prepare images array
  const images = (() => {
    if (clinic.imageDetails?.length) {
      return clinic.imageDetails.map((img) => ({
        url: img.imageUrl,
        isPrimary: img.isPrimary,
      }))
    }
    if (clinic.images?.length) {
      return clinic.images.map((img, idx) =>
        typeof img === 'string'
          ? { url: img, isPrimary: idx === 0 }
          : { url: img.imageUrl, isPrimary: img.isPrimary },
      )
    }
    return []
  })()

  // Scroll handlers
  const updateScrollState = () => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScrollLeft = scrollWidth - clientWidth - 1
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < maxScrollLeft)
  }

  const handleScrollRight = () => {
    const el = scrollRef.current
    if (!el) return
    const delta = el.clientWidth * 0.8
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  const handleScrollLeft = () => {
    const el = scrollRef.current
    if (!el) return
    const delta = el.clientWidth * 0.8
    el.scrollBy({ left: -delta, behavior: 'smooth' })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [images])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div
        className="relative w-full max-w-4xl bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-4 border-black p-6 bg-amber-500">
          <h2 className="text-2xl font-black uppercase text-black">
            Chi tiết phòng khám
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-black text-white border-2 border-black hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.4)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Basic Info */}
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Thông tin cơ bản</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Tên phòng khám</label>
                <p className="text-base font-bold text-black mt-1">{clinic.name}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Số điện thoại</label>
                <p className="text-base font-bold text-black mt-1">{clinic.phone}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Email</label>
                <p className="text-base font-bold text-black mt-1">{clinic.email || 'N/A'}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Trạng thái</label>
                <p className="text-base font-bold text-black mt-1 uppercase">{clinic.status}</p>
              </div>
            </div>
            {clinic.description && (
              <div className="mt-4">
                <label className="text-xs font-bold uppercase text-stone-600">Mô tả</label>
                <p className="text-sm font-bold text-black mt-1 whitespace-pre-wrap">{clinic.description}</p>
              </div>
            )}
          </div>

          {/* Owner Info */}
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Chủ sở hữu</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Tên</label>
                <p className="text-base font-bold text-black mt-1">
                  {clinic.owner?.fullName || clinic.owner?.username || 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Email</label>
                <p className="text-base font-bold text-black mt-1">{clinic.owner?.email || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Địa chỉ</h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Địa chỉ</label>
                <p className="text-base font-bold text-black mt-1">{clinic.address}</p>
              </div>
              {(clinic.district || clinic.province) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clinic.district && (
                    <div>
                      <label className="text-xs font-bold uppercase text-stone-600">Quận/Huyện</label>
                      <p className="text-base font-bold text-black mt-1">{clinic.district}</p>
                    </div>
                  )}
                  {clinic.province && (
                    <div>
                      <label className="text-xs font-bold uppercase text-stone-600">Tỉnh/Thành phố</label>
                      <p className="text-base font-bold text-black mt-1">{clinic.province}</p>
                    </div>
                  )}
                </div>
              )}
              {clinic.specificLocation && (
                <div>
                  <label className="text-xs font-bold uppercase text-stone-600">Vị trí cụ thể</label>
                  <p className="text-base font-bold text-black mt-1">{clinic.specificLocation}</p>
                </div>
              )}
              {(clinic.latitude && clinic.longitude) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-stone-600">Vĩ độ</label>
                    <p className="text-base font-bold text-black mt-1">{clinic.latitude}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase text-stone-600">Kinh độ</label>
                    <p className="text-base font-bold text-black mt-1">{clinic.longitude}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Map */}
          {clinic.latitude && clinic.longitude && (
            <div className="border-4 border-black p-4 bg-stone-50">
              <h3 className="text-lg font-black uppercase text-black mb-4">Vị trí trên bản đồ</h3>
              <ClinicMapOSM clinic={clinic} height="400px" zoom={15} />
            </div>
          )}

          {/* Operating Hours */}
          {clinic.operatingHours && (
            <div className="border-4 border-black p-4 bg-stone-50">
              <h3 className="text-lg font-black uppercase text-black mb-4">Giờ hoạt động</h3>
              <pre className="text-sm font-bold text-black whitespace-pre-wrap">{formatOperatingHours()}</pre>
            </div>
          )}

          {/* Business License */}
          <div className="border-4 border-black p-4 bg-amber-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Giấy phép kinh doanh</h3>
            {clinic.businessLicenseUrl ? (
              <ImageViewer src={clinic.businessLicenseUrl} alt="Giấy phép kinh doanh" />
            ) : (
              <div className="flex items-center gap-3 p-4 bg-red-100 border-2 border-red-600">
                <DocumentTextIcon className="w-6 h-6 text-red-600" />
                <p className="font-bold text-red-700">Chưa tải lên giấy phép kinh doanh</p>
              </div>
            )}
          </div>

          {/* Images Gallery */}
          {images.length > 0 && (
            <div className="card-brutal p-6">
              <h3 className="text-lg font-bold uppercase text-stone-900 mb-4">
                Hình ảnh ({images.length})
              </h3>
              {images.length === 1 ? (
                <div className="relative">
                  <div className="card-brutal overflow-hidden w-full">
                    <img
                      src={images[0].url}
                      alt={`${clinic.name} - Image 1`}
                      className="w-full h-auto max-h-[480px] object-cover cursor-pointer"
                      onClick={() => window.open(images[0].url, '_blank')}
                    />
                  </div>
                  {images[0].isPrimary && (
                    <div className="absolute top-2 left-2 bg-amber-600 text-white font-bold uppercase text-xs px-2 py-1 border-2 border-stone-900 shadow-brutal">
                      PRIMARY
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative">
                  {/* Horizontal gallery */}
                  <div
                    ref={scrollRef}
                    className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {images.map((image, index) => (
                      <div key={index} className="relative group min-w-[240px] md:min-w-[280px] snap-start">
                        <div className="card-brutal overflow-hidden aspect-square">
                          <img
                            src={image.url}
                            alt={`${clinic.name} - Image ${index + 1}`}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => window.open(image.url, '_blank')}
                          />
                        </div>
                        {(image.isPrimary || index === 0) && (
                          <div className="absolute top-2 left-2 bg-amber-600 text-white font-bold uppercase text-xs px-2 py-1 border-2 border-stone-900 shadow-brutal">
                            PRIMARY
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Scroll arrows */}
                  {canScrollLeft && (
                    <button
                      type="button"
                      onClick={handleScrollLeft}
                      className="hidden md:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 w-10 h-14 bg-white/30 backdrop-blur border-2 border-white/60 shadow-xl transition hover:bg-white/70 hover:scale-105 active:scale-100"
                    >
                      <ChevronLeftIcon className="w-6 h-6 text-stone-900" />
                    </button>
                  )}
                  {canScrollRight && (
                    <button
                      type="button"
                      onClick={handleScrollRight}
                      className="hidden md:flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 w-10 h-14 bg-white/30 backdrop-blur border-2 border-white/60 shadow-xl transition hover:bg-white/70 hover:scale-105 active:scale-100"
                    >
                      <ChevronRightIcon className="w-6 h-6 text-stone-900" />
                    </button>
                  )}

                  {/* Mobile hint */}
                  {canScrollRight && (
                    <div className="absolute right-2 bottom-2 md:hidden flex items-center justify-center w-8 h-12 bg-white/30 backdrop-blur border-2 border-white/60 shadow-lg animate-pulse">
                      <ChevronRightIcon className="w-5 h-5 text-stone-900" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="border-4 border-black p-4 bg-stone-50">
            <h3 className="text-lg font-black uppercase text-black mb-4">Thông tin thời gian</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Ngày tạo</label>
                <p className="text-base font-bold text-black mt-1">{formatDate(clinic.createdAt)}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-600">Ngày cập nhật</label>
                <p className="text-base font-bold text-black mt-1">{formatDate(clinic.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-4 border-black p-4 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white text-black font-black uppercase border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

