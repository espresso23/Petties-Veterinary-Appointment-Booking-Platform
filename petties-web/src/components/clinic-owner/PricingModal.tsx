import React, { useEffect, useState } from 'react'
import {
  XMarkIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'

export interface PricingData {
  pricePerKm: number
  sosFee: number
}

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: PricingData) => void
  initialData?: PricingData
}

export function PricingModal({
  isOpen,
  onClose,
  onSave,
  initialData = {
    pricePerKm: 5000,
    sosFee: 100000,
  },
}: PricingModalProps) {
  const [data, setData] = useState<PricingData>(initialData)

  useEffect(() => {
    if (isOpen && initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(initialData)
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(data)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#FF6B35] border-b-4 border-black p-6 flex justify-between items-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-white uppercase tracking-tight">
              Cấu hình giá chung
            </h2>
            <p className="text-white/80 font-bold text-sm mt-1 uppercase">
              Áp dụng cho toàn bộ dịch vụ của phòng khám
            </p>
          </div>
          <button
            onClick={onClose}
            className="relative z-10 w-12 h-12 bg-white border-4 border-black flex items-center justify-center hover:bg-gray-100 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
          >
            <XMarkIcon className="w-7 h-7 text-black" />
          </button>

          {/* Decorative background element */}
          <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="bg-amber-50 border-4 border-black p-4 flex gap-4 items-start">
            <InformationCircleIcon className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
            <p className="text-sm font-bold text-amber-900">
              Các thông số dưới đây được thiết lập một lần cho toàn phòng khám.
              Đơn giá KM sẽ áp dụng cho tất cả dịch vụ tại nhà, và phí SOS sẽ áp dụng cho mọi yêu cầu cấp cứu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Price Per KM Section */}
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-black text-black uppercase tracking-wider mb-2 block">
                  Đơn giá di chuyển (đ/KM)
                </span>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MapPinIcon className="h-6 w-6 text-gray-400 group-focus-within:text-black transition-colors" />
                  </div>
                  <input
                    type="number"
                    value={data.pricePerKm}
                    onChange={(e) => setData({ ...data, pricePerKm: Number(e.target.value) })}
                    className="block w-full pl-12 pr-4 py-4 bg-gray-50 border-4 border-black text-xl font-black focus:bg-white focus:ring-0 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px]"
                    placeholder="Ví dụ: 10000"
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-gray-500 uppercase italic">
                  * Áp dụng khi khách hàng đặt dịch vụ tại nhà
                </p>
              </label>
            </div>

            {/* SOS Fee Section */}
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-black text-black uppercase tracking-wider mb-2 block text-red-600">
                  Phí dịch vụ cấp cứu SOS (VNĐ)
                </span>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-400 group-focus-within:text-red-600 transition-colors" />
                  </div>
                  <input
                    type="number"
                    value={data.sosFee}
                    onChange={(e) => setData({ ...data, sosFee: Number(e.target.value) })}
                    className="block w-full pl-12 pr-4 py-4 bg-red-50 border-4 border-black text-xl font-black focus:bg-white focus:ring-0 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:shadow-none focus:translate-x-[2px] focus:translate-y-[2px]"
                    placeholder="Ví dụ: 50000"
                  />
                </div>
                <p className="mt-2 text-xs font-bold text-gray-500 uppercase italic">
                  * Phụ phí cố định cho mỗi ca cấp cứu SOS
                </p>
              </label>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-5 bg-[#FF6B35] border-4 border-black text-black font-black text-xl uppercase shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center justify-center gap-3"
            >
              <CurrencyDollarIcon className="w-7 h-7" />
              Lưu cấu hình toàn hệ thống
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
