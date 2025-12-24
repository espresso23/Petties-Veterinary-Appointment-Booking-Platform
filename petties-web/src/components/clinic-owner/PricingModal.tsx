import React, { useEffect, useState } from 'react'
import { XMarkIcon, MapPinIcon, ArrowUpIcon } from '@heroicons/react/24/solid'

export interface PricingData {
  pricePerKm: number
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
  },
}: PricingModalProps) {
  const [data, setData] = useState<PricingData>(initialData)

  useEffect(() => {
    if (isOpen && initialData) {
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
        className="relative w-full max-w-md bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ backgroundColor: '#FF6B35' }}
          className="flex items-center justify-between border-b-4 border-black p-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <MapPinIcon className="w-6 h-6 text-black" />
            </div>
            <div>
              <h2 className="text-black font-[900] text-xl uppercase leading-tight">
                Giá Di Chuyển
              </h2>
              <p className="text-black/70 font-bold text-[11px] uppercase tracking-wider">
                Cấu hình phí mỗi kilomet
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white border-2 border-black hover:bg-gray-100 transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-x-[3px] active:translate-y-[3px]"
          >
            <XMarkIcon className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-[900] text-sm uppercase text-black">
                <ArrowUpIcon className="w-4 h-4" />
                Giá mỗi KM (VNĐ)
              </label>

              <div className="relative group">
                <input
                  type="number"
                  required
                  min="0"
                  step="1000"
                  value={data.pricePerKm}
                  onChange={(e) => setData({ pricePerKm: Number(e.target.value) })}
                  className="w-full p-4 bg-white border-4 border-black font-black text-xl text-black focus:outline-none focus:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:text-gray-400 pr-16"
                  placeholder="5,000"
                  style={{ color: '#000000' }}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-sm text-black bg-gray-100 px-2 py-1 border-2 border-black">
                  VNĐ
                </div>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 p-3 flex gap-3 items-start mt-4">
                <div className="mt-1">
                  <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                </div>
                <p className="text-[13px] font-bold text-blue-800 leading-snug">
                  Lưu ý: Giá này sẽ được áp dụng tự động cho tất cả các dịch vụ tận nhà của phòng khám.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-4 bg-[#FF6B35] border-4 border-black text-black font-[900] text-lg uppercase shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all flex items-center justify-center gap-2"
            >
              Lưu cấu hình
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
