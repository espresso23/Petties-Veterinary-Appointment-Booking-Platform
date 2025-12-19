import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export interface PricingData {
  range0to5: number
  range5to10: number
  range10to20: number
  range20plus: number
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
    range0to5: 10000,
    range5to10: 15000,
    range10to20: 20000,
    range20plus: 25000,
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

  const handleChange = (key: keyof PricingData, value: string) => {
    setData((prev) => ({
      ...prev,
      [key]: Number(value),
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{ backgroundColor: '#FF6B35' }}
          className="flex items-center justify-between border-b-4 border-black p-6"
        >
          <div>
            <h2 
              style={{ color: '#000000', fontWeight: '900', fontSize: '20px', textTransform: 'uppercase', lineHeight: '1.2' }}
            >
              Định giá di chuyển
            </h2>
            <p 
              style={{ color: 'rgba(0,0,0,0.8)', fontWeight: '700', fontSize: '12px', marginTop: '4px' }}
            >
              Thiết lập giá cước theo khoảng cách
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black hover:text-white transition-colors border-2 border-black bg-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label 
                style={{ display: 'block', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', color: '#000000' }}
              >
                0 - 5 km
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={data.range0to5}
                onChange={(e) => handleChange('range0to5', e.target.value)}
                className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                placeholder="Nhập số tiền"
                style={{
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            <div className="space-y-2">
              <label 
                style={{ display: 'block', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', color: '#000000' }}
              >
                5 - 10 km
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={data.range5to10}
                onChange={(e) => handleChange('range5to10', e.target.value)}
                className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                placeholder="Nhập số tiền"
                style={{
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            <div className="space-y-2">
              <label 
                style={{ display: 'block', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', color: '#000000' }}
              >
                10 - 20 km
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={data.range10to20}
                onChange={(e) => handleChange('range10to20', e.target.value)}
                className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                placeholder="Nhập số tiền"
                style={{
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>

            <div className="space-y-2">
              <label 
                style={{ display: 'block', fontWeight: '900', fontSize: '14px', textTransform: 'uppercase', color: '#000000' }}
              >
                Trên 20 km
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                value={data.range20plus}
                onChange={(e) => handleChange('range20plus', e.target.value)}
                className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                placeholder="Nhập số tiền"
                style={{
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full py-3 px-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
              style={{ 
                backgroundColor: '#FF6B35',
                fontWeight: '900',
                fontSize: '18px',
                textTransform: 'uppercase',
                color: '#000000'
              }}
            >
              XÁC NHẬN
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
