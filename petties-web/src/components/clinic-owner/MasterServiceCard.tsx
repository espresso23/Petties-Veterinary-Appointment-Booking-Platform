import React, { useState } from 'react'
import {
  PencilIcon,
  TrashIcon,
  ClockIcon,
  HomeIcon,
  BeakerIcon,
  HeartIcon,
  ScissorsIcon,
  InformationCircleIcon,
  XMarkIcon,
  ScaleIcon,
} from '@heroicons/react/24/solid'
import type { WeightPriceDto } from '../../types/service'

export interface MasterService {
  id: string
  name: string
  defaultPrice: number
  slotsRequired: number
  durationTime: number // in minutes
  isHomeVisit: boolean
  defaultPricePerKm?: number
  serviceCategory?: string
  petType?: string
  description?: string
  icon?: string
  weightPrices?: WeightPriceDto[]
}

interface MasterServiceCardProps {
  service: MasterService
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  onToggleHomeVisit?: (e: React.MouseEvent) => void
  onClick: () => void
  isSelectable?: boolean
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
}

export function MasterServiceCard({
  service,
  onEdit,
  onDelete,
  onToggleHomeVisit,
  onClick,
  isSelectable = false,
  isSelected = false,
  onSelect,
}: MasterServiceCardProps) {
  const [showPriceModal, setShowPriceModal] = useState(false)

  // Format price display
  const getPriceDisplay = () => {
    return new Intl.NumberFormat('vi-VN').format(service.defaultPrice) + ' VNĐ'
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
    <div
      onClick={onClick}
      className={`group relative bg-white border-4 border-black p-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between h-full min-h-[200px] ${
        isSelectable && isSelected ? 'ring-4 ring-green-500' : ''
      }`}
    >
      {/* Checkbox for selection mode */}
      {isSelectable && (
        <div className="absolute top-4 left-4 z-20">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation()
              onSelect?.(e.target.checked)
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-6 h-6 border-4 border-black cursor-pointer accent-green-600"
          />
        </div>
      )}

      {/* Location Badge - Top Left - adjust if selectable */}
      {service.isHomeVisit ? (
        <div
          style={{ backgroundColor: '#60a5fa' }}
          className={`absolute top-4 z-10 border-2 border-black px-2 py-1 flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
            isSelectable ? 'left-14' : 'left-4'
          }`}
        >
          <HomeIcon className="w-3.5 h-3.5 text-black" />
          <span className="text-xs font-black text-black uppercase">Tận nhà</span>
        </div>
      ) : (
        <div
          style={{ backgroundColor: '#fcd34d' }}
          className={`absolute top-4 z-10 border-2 border-black px-2 py-1 flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
            isSelectable ? 'left-14' : 'left-4'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-black animate-pulse" />
          <span className="text-xs font-black text-black uppercase">Tại phòng khám</span>
        </div>
      )}

      {/* Action Buttons - Top Right (No Active Toggle) */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        {onToggleHomeVisit && (
          <button
            onClick={onToggleHomeVisit}
            style={{ backgroundColor: service.isHomeVisit ? '#10b981' : '#6b7280' }}
            className="p-2 border-2 border-black transition-colors hover:opacity-80 flex items-center gap-1"
            title={service.isHomeVisit ? "Chuyển thành dịch vụ tại phòng khám" : "Chuyển thành dịch vụ tận nhà"}
          >
            <HomeIcon className="w-4 h-4 text-white" />
            <span className="text-xs font-black text-white uppercase">
              {service.isHomeVisit ? 'Tận nhà' : 'Tại chỗ'}
            </span>
          </button>
        )}
        <button
          onClick={onEdit}
          style={{ backgroundColor: '#fb923c' }}
          className="p-2 border-2 border-black transition-colors hover:opacity-80"
          title="Chỉnh sửa dịch vụ mẫu"
        >
          <PencilIcon className="w-4 h-4 text-black" />
        </button>
        <button
          onClick={onDelete}
          style={{ backgroundColor: '#f87171' }}
          className="p-2 border-2 border-black transition-colors hover:opacity-80"
          title="Xóa dịch vụ mẫu"
        >
          <TrashIcon className="w-4 h-4 text-black" />
        </button>
      </div>

      {/* Card Content */}
      <div className="mt-8">
        <h3 className="text-2xl font-black text-black mb-2 uppercase tracking-tight">
          {service.name}
        </h3>

        {/* Description if exists */}
        {service.description && (
          <p className="text-sm font-bold text-gray-600 mb-3 line-clamp-2">
            {service.description}
          </p>
        )}

        <div className="space-y-3 mt-4">
          <div className="flex items-start justify-between border-b-2 border-black pb-2">
            <span className="font-bold text-gray-600">GIÁ MẶC ĐỊNH</span>
            <div className="text-right">
              <span className="font-black text-xl text-[#FF6B35]">
                {formattedPrice}
              </span>
              {service.isHomeVisit && service.defaultPricePerKm !== undefined && service.defaultPricePerKm > 0 && (
                <div className="text-[10px] font-black text-green-600 mt-1 uppercase">
                  +{service.defaultPricePerKm.toLocaleString('vi-VN')} VNĐ / KM
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-600 flex items-center gap-2">
              <ClockIcon className="w-5 h-5" /> THỜI GIAN
            </span>
            <span className="font-bold text-black">
              {service.durationTime} phút
            </span>
          </div>

          {service.serviceCategory && (
            <div className="flex items-center justify-between border-t-2 border-black pt-2">
              <span className="font-black text-[11px] text-gray-500 uppercase tracking-widest">Loại dịch vụ</span>
              {categoryInfo && (
                <div
                  style={{ backgroundColor: categoryInfo.color }}
                  className="border-2 border-black px-2 py-1 flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  <categoryInfo.icon className="w-3.5 h-3.5 text-black" />
                  <span className="text-[10px] font-black text-black uppercase">{categoryInfo.label}</span>
                </div>
              )}
            </div>
          )}

          {service.petType && (
            <div className="flex items-center justify-between">
              <span className="font-black text-[11px] text-gray-500 uppercase tracking-widest">Loại thú cưng</span>
              <span className="text-[11px] font-black text-black uppercase bg-amber-100 border-2 border-black px-2 py-1">
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
                className="flex items-center gap-2 text-xs font-black text-purple-600 hover:text-purple-800 transition-colors uppercase"
              >
                <ScaleIcon className="w-4 h-4" />
                Xem giá theo cân nặng
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Template Badge - Bottom */}
      <div className="mt-4 pt-3 border-t-2 border-black">
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">
            DỊCH VỤ MẪU
          </span>
        </div>
      </div>

      {/* Weight Price Modal */}
      {showPriceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            e.stopPropagation()
            setShowPriceModal(false)
          }}
        >
          <div
            className="bg-white border-4 border-black p-6 max-w-md w-full mx-4 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b-4 border-black">
              <h3 className="text-xl font-black uppercase flex items-center gap-2">
                <ScaleIcon className="w-5 h-5" />
                Giá theo cân nặng
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowPriceModal(false)
                }}
                className="p-2 hover:bg-gray-100 transition-colors border-2 border-black"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {service.weightPrices?.map((tier, index) => (
                <div key={index} className="p-4 border-2 border-black bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-black uppercase text-gray-600">
                      Cân nặng
                    </span>
                    <span className="text-lg font-black">
                      {tier.minWeight} - {tier.maxWeight} kg
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black uppercase text-gray-600">
                      Giá
                    </span>
                    <span className="text-xl font-black text-purple-600">
                      {tier.price.toLocaleString('vi-VN')} VNĐ
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-3 bg-amber-100 border-2 border-black flex items-start gap-2">
              <InformationCircleIcon className="w-5 h-5 text-amber-700 flex-shrink-0" />
              <p className="text-xs font-bold text-amber-800">
                Giá dịch vụ sẽ thay đổi dựa trên cân nặng thú cưng của bạn.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
