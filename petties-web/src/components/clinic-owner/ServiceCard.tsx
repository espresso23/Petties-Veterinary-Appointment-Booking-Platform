import React, { useState } from 'react'
import { Edit2, Trash2, Power, Clock, Home, Info, X } from 'lucide-react'
import type { WeightPriceDto } from '../../types/service'

export interface Service {
  id: string
  name: string
  price: number
  duration: number // in minutes
  isActive: boolean
  isHomeVisit: boolean
  pricePerKm?: number
  serviceCategory?: string
  petType?: string
  weightPrices?: WeightPriceDto[]
}

interface ServiceCardProps {
  service: Service
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onToggleStatus: (e: React.MouseEvent) => void
  onClick: () => void
}

export function ServiceCard({
  service,
  onEdit,
  onDelete,
  onToggleStatus,
  onClick,
}: ServiceCardProps) {
  const [showPriceModal, setShowPriceModal] = useState(false)
  
  // Calculate price range from weight prices
  const getPriceDisplay = () => {
    if (!service.weightPrices || service.weightPrices.length === 0) {
      // No weight prices, just show base price
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(service.price)
    }
    
    // Has weight prices: show base + min to base + max
    const prices = service.weightPrices.map(wp => Number(wp.price))
    const minTierPrice = Math.min(...prices)
    const maxTierPrice = Math.max(...prices)
    
    const minTotal = service.price + minTierPrice
    const maxTotal = service.price + maxTierPrice
    
    const formatPrice = (price: number) => new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price)
    
    if (minTierPrice === maxTierPrice) {
      return formatPrice(minTotal)
    }
    
    return `${formatPrice(minTotal)} - ${formatPrice(maxTotal)}`
  }

  const formattedPrice = getPriceDisplay()

  return (
    <>
    <div
      onClick={onClick}
      className="group relative bg-white border-4 border-black p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between h-full min-h-[200px]"
    >
      {/* Home Visit Badge - Top Left */}
      {service.isHomeVisit && (
        <div 
          style={{ backgroundColor: '#60a5fa' }}
          className="absolute top-4 left-4 z-10 border-2 border-black px-2 py-1 flex items-center gap-1"
        >
          <Home size={14} className="text-black" strokeWidth={3} />
          <span className="text-xs font-black text-black">TẬN NHÀ</span>
        </div>
      )}

      {/* Action Buttons - Absolute positioned top-right */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={onToggleStatus}
          style={{ backgroundColor: service.isActive ? '#86efac' : '#d1d5db' }}
          className="p-2 border-2 border-black transition-colors hover:opacity-80"
          title={service.isActive ? 'Disable Service' : 'Enable Service'}
        >
          <Power size={16} className="text-black" />
        </button>
        <button
          onClick={onEdit}
          style={{ backgroundColor: '#fb923c' }}
          className="p-2 border-2 border-black transition-colors hover:opacity-80"
          title="Edit Service"
        >
          <Edit2 size={16} className="text-black" />
        </button>
        <button
          onClick={onDelete}
          style={{ backgroundColor: '#f87171' }}
          className="p-2 border-2 border-black transition-colors hover:opacity-80"
          title="Delete Service"
        >
          <Trash2 size={16} className="text-black" />
        </button>
      </div>

      {/* Card Content */}
      <div className="mt-8">
        <h3 className="text-2xl font-black text-black mb-2 uppercase tracking-tight">
          {service.name}
        </h3>

        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <span className="font-bold text-gray-600">GIÁ DỊCH VỤ</span>
            <span className="font-black text-xl text-[#FF6B35]">
              {formattedPrice}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-600 flex items-center gap-2">
              <Clock size={18} /> THỜI GIAN
            </span>
            <span className="font-bold text-black">
              {service.duration} phút
            </span>
          </div>

          {service.serviceCategory && (
            <div className="flex items-center justify-between border-t-2 border-black pt-2">
              <span className="font-bold text-gray-600">LOẠI DỊCH VỤ</span>
              <span className="font-bold text-black text-sm">
                {service.serviceCategory}
              </span>
            </div>
          )}

          {service.petType && (
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-600">THÚ CƯNG</span>
              <span className="font-bold text-black">
                {service.petType}
              </span>
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
                  <Info size={16} />
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
              className="p-1 bg-white border-2 border-black hover:bg-gray-100"
            >
              <X size={20} className="text-black" />
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
                {service.price.toLocaleString('vi-VN')}đ
              </span>
            </div>
          </div>

          {/* Weight Price Tiers */}
          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
            <p className="text-sm font-bold text-gray-600 mb-3">PHỤ PHÍ THEO CÂN NẶNG</p>
            {service.weightPrices?.map((wp, idx) => (
              <div 
                key={idx}
                className="border-2 border-black p-3 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="bg-blue-500 text-white px-2 py-1 border-2 border-black font-bold text-xs">
                        MỨC {idx + 1}
                      </div>
                      <span className="font-black text-gray-800">
                        {wp.minWeight} - {wp.maxWeight} kg
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      Tổng cộng: <span className="font-black text-black">
                        {(service.price + Number(wp.price)).toLocaleString('vi-VN')}đ
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-gray-500">PHỤ PHÍ</div>
                    <div className="text-lg font-black text-green-600">
                      +{Number(wp.price).toLocaleString('vi-VN')}đ
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <div className="bg-gray-100 border-t-2 border-black p-3">
            <p className="text-xs text-gray-600 italic">
              💡 Giá cuối cùng = Giá cơ bản + Phụ phí theo cân nặng thú cưng
            </p>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
