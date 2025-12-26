import React, { useState } from 'react'
import {
  PencilIcon,
  TrashIcon,
  PowerIcon,
  ClockIcon,
  HomeIcon,
  InformationCircleIcon,
  XMarkIcon,
  BeakerIcon,
  HeartIcon,
  ScissorsIcon,
  ScaleIcon,
} from '@heroicons/react/24/solid'
import type { WeightPriceDto } from '../../types/service'

export interface ClinicService {
  id: string
  name: string
  price: number
  slotsRequired: number
  duration: number // in minutes
  isActive: boolean
  isHomeVisit: boolean
  pricePerKm?: number
  serviceCategory?: string
  petType?: string
  weightPrices?: WeightPriceDto[]
}

interface ServiceCardProps {
  service: ClinicService
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onToggleStatus: (e: React.MouseEvent) => void
  onToggleHomeVisit?: (e: React.MouseEvent) => void
  onConfigPricePerKm?: (e: React.MouseEvent) => void
  onClick: () => void
}

export function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleHomeVisit,
  onConfigPricePerKm,
  onClick,
}: ServiceCardProps) {
  const [showPriceModal, setShowPriceModal] = useState(false)

  // Calculate price range from base price + weight prices
  const calculatePriceRange = () => {
    const basePrice = service.price
    if (!service.weightPrices || service.weightPrices.length === 0) {
      return {
        min: basePrice,
        max: basePrice,
        hasRange: false
      }
    }
    
    const weightPrices = service.weightPrices.map(wp => wp.price)
    const minWeightPrice = Math.min(...weightPrices)
    const maxWeightPrice = Math.max(...weightPrices)
    
    return {
      min: basePrice + minWeightPrice,
      max: basePrice + maxWeightPrice,
      hasRange: minWeightPrice !== maxWeightPrice
    }
  }

  const priceRange = calculatePriceRange()

  // Format price display
  const getPriceDisplay = () => {
    if (priceRange.hasRange) {
      const minFormatted = new Intl.NumberFormat('vi-VN').format(priceRange.min)
      const maxFormatted = new Intl.NumberFormat('vi-VN').format(priceRange.max)
      return `${minFormatted} - ${maxFormatted} VNĐ`
    }
    return new Intl.NumberFormat('vi-VN').format(service.price) + ' VNĐ'
  }

  const formattedPrice = getPriceDisplay()

  const categories = [
    { id: 'Y Tế & Chăm Sóc Sức Khỏe', label: 'Y Tế & Chăm Sóc Sức Khỏe', icon: BeakerIcon, color: '#e0f2fe' },
    { id: 'Chăm sóc sức khỏe chuyên sâu', label: 'Chăm sóc sức khỏe chuyên sâu', icon: HeartIcon, color: '#fef2f2' },
    { id: 'Tiêm phòng', label: 'Tiêm phòng', icon: BeakerIcon, color: '#ecfdf5' },
    { id: 'Làm Đẹp (Grooming) & Spa', label: 'Làm Đẹp (Grooming) & Spa', icon: ScissorsIcon, color: '#f5f3ff' },
    { id: 'Trông Giữ & Lưu Trú', label: 'Trông Giữ & Lưu Trú', icon: HomeIcon, color: '#fffbeb' },
  ]

  const categoryInfo = categories.find(c => c.id === service.serviceCategory)

  return (
    <>
      <div
        onClick={onClick}
        className="group relative bg-white border-4 border-black p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between h-full min-h-[200px]"
      >
        {/* Location Badge - Top Left */}
        {service.isHomeVisit ? (
          <div
            style={{ backgroundColor: '#60a5fa' }}
            className="absolute top-4 left-4 z-10 border-2 border-black px-2 py-1 flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <HomeIcon className="w-3.5 h-3.5 text-black" />
            <span className="text-xs font-black text-black uppercase">Tận nhà</span>
          </div>
        ) : (
          <div
            style={{ backgroundColor: '#fcd34d' }}
            className="absolute top-4 left-4 z-10 border-2 border-black px-2 py-1 flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
            <span className="text-xs font-black text-black uppercase">Tại phòng khám</span>
          </div>
        )}

        {/* Action Buttons - Absolute positioned top-right */}
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          {onToggleHomeVisit && (
            <button
              onClick={onToggleHomeVisit}
              style={{ backgroundColor: service.isHomeVisit ? '#10b981' : '#6b7280' }}
              className="p-2 border-2 border-black transition-colors hover:opacity-80 flex items-center gap-1"
              title={service.isHomeVisit ? 'Chuyển thành dịch vụ tại phòng khám' : 'Chuyển thành dịch vụ tận nhà'}
            >
              <HomeIcon className="w-4 h-4 text-white" />
              <span className="text-xs font-black text-white uppercase">
                {service.isHomeVisit ? 'Tận nhà' : 'Tại chỗ'}
              </span>
            </button>
          )}
          <button
            onClick={onToggleStatus}
            style={{ backgroundColor: service.isActive ? '#86efac' : '#d1d5db' }}
            className="p-2 border-2 border-black transition-colors hover:opacity-80"
            title={service.isActive ? 'Disable Service' : 'Enable Service'}
          >
            <PowerIcon className="w-4 h-4 text-black" />
          </button>
          <button
            onClick={onEdit}
            style={{ backgroundColor: '#fb923c' }}
            className="p-2 border-2 border-black transition-colors hover:opacity-80"
            title="Edit Service"
          >
            <PencilIcon className="w-4 h-4 text-black" />
          </button>
          <button
            onClick={onDelete}
            style={{ backgroundColor: '#f87171' }}
            className="p-2 border-2 border-black transition-colors hover:opacity-80"
            title="Delete Service"
          >
            <TrashIcon className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Card Content */}
        <div className="mt-8">
          <h3 className="text-2xl font-black text-black mb-2 uppercase tracking-tight">
            {service.name}
          </h3>

          <div className="space-y-3 mt-4">
            <div className="flex items-start justify-between border-b-2 border-black pb-2">
<<<<<<< HEAD
              <span className="font-bold text-black">
                {priceRange.hasRange ? 'KHOẢNG GIÁ' : 'GIÁ DỊCH VỤ'}
              </span>
=======
              <span className="font-bold text-black">GIÁ DỊCH VỤ</span>
>>>>>>> eb030e2ad37ad93338ebe76af68939991b9a3dbe
              <div className="text-right">
                <span className="font-black text-xl text-[#FF6B35]">
                  {formattedPrice}
                </span>
                {service.isHomeVisit && service.pricePerKm !== undefined && service.pricePerKm > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-[10px] font-black text-green-600 uppercase">
                      +{service.pricePerKm.toLocaleString('vi-VN')} VNĐ / KM
                    </div>
                    {onConfigPricePerKm && (
                      <button
                        onClick={onConfigPricePerKm}
                        style={{
                          marginLeft: 'auto',
                          fontSize: '10px',
                          fontWeight: '900',
                          backgroundColor: 'rgb(231 229 228)',
                          padding: '2px 8px',
                          border: '2px solid black',
                          textTransform: 'uppercase',
                          color: 'black'
                        }}
                        title="Config giá per km"
                      >
                        Sửa
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-bold text-black flex items-center gap-2">
                <ClockIcon className="w-5 h-5" /> THỜI GIAN
              </span>
              <span className="font-bold text-black">
                {service.duration} phút
              </span>
            </div>

            {service.serviceCategory && (
              <div className="flex items-center justify-between border-t-2 border-black pt-2">
                <span className="font-black text-[11px] text-black uppercase tracking-widest">Loại dịch vụ</span>
                <div className="flex items-center gap-2 bg-white border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {categoryInfo && (
                    <div
                      className="p-1 border border-black"
                      style={{ backgroundColor: categoryInfo.color }}
                    >
                      <categoryInfo.icon className="w-3 h-3 text-black" />
                    </div>
                  )}
                  <span className="font-black text-black text-[11px] uppercase truncate max-w-[120px]">
                    {service.serviceCategory}
                  </span>
                </div>
              </div>
            )}

            {service.petType && (
              <div className="flex items-center justify-between border-t-2 border-black pt-2">
                <span className="font-black text-[11px] text-gray-500 uppercase tracking-widest">Thú cưng</span>
                <div className="bg-white border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <span className="font-black text-black text-[11px] uppercase">
                    {service.petType}
                  </span>
                </div>
              </div>
            )}

            {service.weightPrices && service.weightPrices.length > 0 && (
              <div className="border-t-2 border-black pt-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowPriceModal(true)
                  }}
                  className="w-full flex items-center justify-between p-2 border-2 border-black hover:bg-opacity-90 transition-colors"
                  style={{ backgroundColor: '#FF6B35' }}
                >
                  <span className="font-bold text-white flex items-center gap-2">
                    <InformationCircleIcon className="w-4 h-4" />
                    {service.weightPrices.length} MỨC GIÁ THEO CÂN NẶNG
                  </span>
                  <span className="text-xs font-bold text-white">XEM CHI TIẾT</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {!service.isActive && (
          <div className="absolute inset-0 bg-gray-200/50 backdrop-blur-[1px] flex items-center justify-center border-4 border-black">
            <span className="bg-black text-white px-4 py-2 font-black text-lg transform -rotate-12 border-2 border-white shadow-lg">
              ĐANG ẨN
            </span>
          </div>
        )}
      </div>

      {/* Weight Prices Overlay Modal */}
      {showPriceModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            e.stopPropagation()
            setShowPriceModal(false)
          }}
        >
          <div
            className="bg-white border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-[#FF6B35] border-b-4 border-black p-4 flex justify-between items-center">
              <h3 className="text-xl font-black text-white uppercase">
                Bảng giá theo cân nặng
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPriceModal(false)
                }}
                className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black hover:bg-gray-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
                style={{ color: '#000000' }}
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Service Name */}
            <div className="bg-gray-50 border-b-2 border-black p-3">
              <p className="text-sm font-bold text-gray-600">DỊCH VỤ</p>
              <p className="text-lg font-black text-black">{service.name}</p>
            </div>

            {/* Base Price */}
            <div className="bg-yellow-50 border-b-2 border-black p-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700">GIÁ CƠ BẢN</span>
                <span className="text-xl font-black text-[#FF6B35]">
                  {service.price.toLocaleString('vi-VN')} VNĐ
                </span>
              </div>
            </div>

            {/* Price Per KM (only for home visit services) */}
            {service.isHomeVisit && service.pricePerKm !== undefined && service.pricePerKm > 0 && (
              <div className="bg-blue-50 border-b-2 border-black p-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <HomeIcon className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-gray-700 uppercase text-sm">Phụ phí di chuyển</span>
                  </div>
                  <span className="text-lg font-black text-green-600">
                    +{service.pricePerKm.toLocaleString('vi-VN')} VNĐ / KM
                  </span>
                </div>
              </div>
            )}

            {/* Weight Price Tiers */}
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Phụ phí theo cân nặng</p>
              {service.weightPrices?.map((wp, idx) => (
                <div
                  key={idx}
                  className="border-4 border-black p-4 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 border-2 border-black bg-[#e0f2fe] flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      <ScaleIcon className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-[10px] uppercase bg-black text-white px-2 py-0.5">MỨC {idx + 1}</span>
                        <span className="font-black text-lg text-black">{wp.minWeight} - {wp.maxWeight} kg</span>
                      </div>
                      <div className="text-sm font-bold text-gray-600">
                        Phụ phí cộng thêm: <span className="text-green-600 font-black">+{Number(wp.price || 0).toLocaleString('vi-VN')} VNĐ</span>
                      </div>
                      <div className="text-[10px] font-bold text-gray-400 mt-1">
                        Tổng cộng: {(service.price + Number(wp.price)).toLocaleString('vi-VN')} VNĐ
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Note */}
            <div className="bg-gray-100 border-t-2 border-black p-3">
              <p className="text-xs font-bold text-gray-600">
                {service.isHomeVisit && service.pricePerKm !== undefined && service.pricePerKm > 0
                  ? 'Giá cuối cùng = Giá cơ bản + Phụ phí cân nặng + Phụ phí di chuyển (KM x giá/KM)'
                  : 'Giá cuối cùng = Giá cơ bản + Phụ phí theo cân nặng thú cưng'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
