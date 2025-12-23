import React, { useEffect, useState } from 'react'
import { X, Loader2, Plus, Trash2, Edit2, Info, AlertCircle, Minus } from 'lucide-react'
import type { Service } from './ServiceCard'
import type { WeightPriceDto } from '../../types/service'

interface ServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (service: Omit<Service, 'id' | 'isActive'>) => void
  initialData?: Service | null
  isSubmitting?: boolean
  defaultPricePerKm?: number
}

export function ServiceModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  isSubmitting = false,
  defaultPricePerKm = 0,
}: ServiceModalProps) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('')
  const [isHomeVisit, setIsHomeVisit] = useState(false)
  const [pricePerKm, setPricePerKm] = useState<number>(defaultPricePerKm)
  const [serviceCategory, setServiceCategory] = useState('')
  const [petType, setPetType] = useState('')
  const [weightPrices, setWeightPrices] = useState<WeightPriceDto[]>([])
  const [showWeightPriceModal, setShowWeightPriceModal] = useState(false)
  const [editingTierIndex, setEditingTierIndex] = useState<number | null>(null)

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name)
        setPrice(initialData.price.toString())
        setDuration(initialData.duration.toString())
        setIsHomeVisit(initialData.isHomeVisit)
        setPricePerKm(initialData.pricePerKm || 0)
        setServiceCategory(initialData.serviceCategory || '')
        setPetType(initialData.petType || '')
        setWeightPrices(initialData.weightPrices || [])
      } else {
        setName('')
        setPrice('')
        setDuration('')
        setIsHomeVisit(false)
        setPricePerKm(defaultPricePerKm)
        setServiceCategory('')
        setPetType('')
        setWeightPrices([])
      }
    }
  }, [isOpen, initialData, defaultPricePerKm])

  const handleAddWeightPrice = () => {
    setWeightPrices([...weightPrices, { minWeight: '', maxWeight: '', price: '' }])
  }

  const handleRemoveWeightPrice = (index: number) => {
    setWeightPrices(weightPrices.filter((_, i) => i !== index))
  }

  const handleWeightPriceChange = (index: number, field: keyof WeightPriceDto, value: string) => {
    const updated = [...weightPrices]
    updated[index] = { ...updated[index], [field]: value }
    setWeightPrices(updated)
  }

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    
    onSave({
      name,
      price: Number(price),
      duration: Number(duration),
      isHomeVisit,
      pricePerKm: isHomeVisit ? pricePerKm : undefined,
      serviceCategory: serviceCategory || undefined,
      petType: petType || undefined,
      weightPrices: weightPrices.length > 0 ? weightPrices : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          style={{ backgroundColor: '#FF6B35' }}
          className="flex items-center justify-between border-b-4 border-black p-6"
        >
          <h2 className="text-2xl font-black uppercase text-black">
            {initialData ? 'Cập nhật dịch vụ' : 'Thêm dịch vụ mới'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black hover:text-white transition-colors border-2 border-black bg-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1">
          <div className="space-y-2">
            <label 
              style={{ 
                fontWeight: '900', 
                fontSize: '18px', 
                textTransform: 'uppercase', 
                display: 'block',
                color: '#000000',
                marginBottom: '8px'
              }}
            >
              Tên dịch vụ
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              placeholder="Ví dụ: Tắm + Vệ sinh cơ bản"
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
              style={{ 
                fontWeight: '900', 
                fontSize: '18px', 
                textTransform: 'uppercase', 
                display: 'block',
                color: '#000000',
                marginBottom: '8px'
              }}
            >
              Giá (VND)
            </label>
            <input
              type="number"
              required
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              placeholder="Ví dụ: 150000"
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
              style={{ 
                fontWeight: '900', 
                fontSize: '18px', 
                textTransform: 'uppercase', 
                display: 'block',
                color: '#000000',
                marginBottom: '8px'
              }}
            >
              Thời gian (Phút)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                required
                readOnly
                value={duration}
                className="flex-1 p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow cursor-not-allowed bg-gray-50"
                placeholder="15"
                style={{
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#000000'
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const currentValue = parseInt(duration) || 0;
                  if (currentValue >= 15) {
                    setDuration(String(currentValue - 15));
                  }
                }}
                className="p-3 bg-red-500 text-white border-4 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!duration || parseInt(duration) <= 15}
                style={{ fontWeight: '900' }}
              >
                <Minus size={24} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentValue = parseInt(duration) || 0;
                  setDuration(String(currentValue + 15));
                }}
                className="p-3 bg-green-500 text-white border-4 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                style={{ fontWeight: '900' }}
              >
                <Plus size={24} />
              </button>
            </div>
            {duration && parseInt(duration) > 0 && (
              <div className="text-sm font-bold text-gray-700">
                📊 Số slots: {Math.ceil(parseInt(duration) / 30)} slot(s)
              </div>
            )}
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border-2 border-yellow-500">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-yellow-800 mb-1">LƯU Ý QUAN TRỌNG:</p>
                <ul className="text-yellow-700 space-y-1 list-disc list-inside">
                  <li>Chỉ nhập bội số của 15 (15, 30, 45, 60, 75, 90...)</li>
                  <li>30 phút = 1 slot thời gian</li>
                  <li>15 phút được tính là 1 slot</li>
                  <li>45-60 phút được tính là 2 slots</li>
                  <li>75-90 phút được tính là 3 slots</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label 
              style={{ 
                fontWeight: '900', 
                fontSize: '18px', 
                textTransform: 'uppercase', 
                display: 'block',
                color: '#000000',
                marginBottom: '8px'
              }}
            >
              Loại dịch vụ
            </label>
            <select
              value={serviceCategory}
              onChange={(e) => setServiceCategory(e.target.value)}
              className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              style={{
                fontWeight: '700',
                fontSize: '16px',
                color: '#000000',
                backgroundColor: '#ffffff'
              }}
            >
              <option value="">-- Chọn loại dịch vụ --</option>
              <option value="Y Tế & Chăm Sóc Sức Khỏe">Y Tế & Chăm Sóc Sức Khỏe</option>
              <option value="Chăm sóc sức khỏe chuyên sâu">Chăm sóc sức khỏe chuyên sâu</option>
              <option value="Tiêm phòng">Tiêm phòng</option>
              <option value="Làm Đẹp (Grooming) & Spa">Làm Đẹp (Grooming) & Spa</option>
              <option value="Trông Giữ & Lưu Trú">Trông Giữ & Lưu Trú</option>
            </select>
          </div>

          <div className="space-y-2">
            <label 
              style={{ 
                fontWeight: '900', 
                fontSize: '18px', 
                textTransform: 'uppercase', 
                display: 'block',
                color: '#000000',
                marginBottom: '8px'
              }}
            >
              Loại thú nuôi
            </label>
            <input
              type="text"
              value={petType}
              onChange={(e) => setPetType(e.target.value)}
              className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              placeholder="Ví dụ: Chó, Mèo, Thỏ..."
              style={{
                fontWeight: '700',
                fontSize: '16px',
                color: '#000000',
                backgroundColor: '#ffffff'
              }}
            />
          </div>

          <div className="space-y-3">
            <label 
              style={{ 
                fontWeight: '900', 
                fontSize: '18px', 
                textTransform: 'uppercase', 
                color: '#000000',
                display: 'block'
              }}
            >
              Giá theo cân nặng (Tùy chọn)
            </label>
            <button
              type="button"
              onClick={() => setShowWeightPriceModal(true)}
              className="w-full p-4 border-4 border-black hover:bg-opacity-90 transition-colors font-bold text-left flex justify-between items-center"
              style={{
                backgroundColor: '#FF6B35'
              }}
            >
              <div>
                <div className="text-lg font-black text-white">
                  {weightPrices.length === 0 ? 'Chưa có mốc giá theo cân nặng' : `${weightPrices.length} mốc giá đã thiết lập`}
                </div>
                <div className="text-sm text-white opacity-80 mt-1">
                  Click để quản lý bảng giá theo cân nặng
                </div>
              </div>
              <Edit2 size={24} className="text-white" />
            </button>
          </div>

          <div className="space-y-2">
            <label 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                cursor: 'pointer', 
                padding: '16px', 
                border: '4px solid #000000', 
                backgroundColor: '#f9fafb' 
              }}
              className="hover:bg-gray-100 transition-colors"
            >
              <input
                type="checkbox"
                checked={isHomeVisit}
                onChange={(e) => setIsHomeVisit(e.target.checked)}
                style={{ 
                  width: '24px', 
                  height: '24px', 
                  border: '4px solid #000000', 
                  accentColor: '#FF6B35', 
                  cursor: 'pointer' 
                }}
              />
              <span 
                style={{ 
                  fontWeight: '900', 
                  fontSize: '18px', 
                  textTransform: 'uppercase',
                  color: '#000000'
                }}
              >
                Dịch vụ tận nhà
              </span>
            </label>
            {isHomeVisit && (
              <div 
                style={{ 
                  fontSize: '13px', 
                  fontWeight: '700', 
                  color: '#059669',
                  backgroundColor: '#d1fae5',
                  padding: '12px',
                  border: '2px solid #10b981',
                  marginTop: '8px'
                }}
              >
                ✓ Giá mỗi km được thiết lập ở phần "Định giá di chuyển" trong menu và áp dụng khi khách đặt dịch vụ tận nhà
              </div>
            )}
          </div>

          <div style={{ paddingTop: '16px', display: 'flex', gap: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ 
                flex: 1,
                padding: '12px 24px',
                backgroundColor: '#ffffff',
                fontWeight: '900',
                fontSize: '18px',
                textTransform: 'uppercase',
                color: '#000000',
                border: '4px solid #000000',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f5f5f4'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff'
              }}
            >
              HỦY BỎ
            </button>
            <button
              disabled={isSubmitting}
              className="flex-1 py-3 px-6 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ 
                backgroundColor: '#FF6B35',
                fontWeight: '900',
                fontSize: '18px',
                textTransform: 'uppercase',
                color: '#000000'
              }}
            >
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {isSubmitting
                ? 'ĐANG XỬ LÝ...'
                : initialData
                  ? 'LƯU THAY ĐỔI'
                  : 'TẠO DỊCH VỤ'}
            </button>
          </div>
        </form>
      </div>

      {/* Weight Price Management Modal Overlay */}
      {showWeightPriceModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowWeightPriceModal(false)}
        >
          <div 
            className="bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div 
              className="border-b-4 border-black p-4 flex justify-between items-center"
              style={{ backgroundColor: '#FF6B35' }}
            >
              <h3 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                <Info size={28} className="text-white" />
                Quản lý giá theo cân nặng
              </h3>
              <button
                onClick={() => setShowWeightPriceModal(false)}
                className="p-2 bg-black bg-opacity-20 border-2 border-white hover:bg-opacity-30"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {weightPrices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-xl font-black text-gray-400 mb-2">
                    Chưa có mốc giá theo cân nặng nào
                  </p>
                  <p className="text-sm text-gray-500">
                    Nhấn nút "Thêm mốc giá" bên dưới để bắt đầu
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {weightPrices.map((tier, index) => (
                    <div 
                      key={index}
                      className="border-4 border-black p-4 bg-white hover:bg-gray-50 transition-colors"
                    >
                      {editingTierIndex === index ? (
                        // Edit Mode
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-sm font-bold mb-2 text-gray-700">
                                Cân nặng tối thiểu (kg)
                              </label>
                              <input
                                type="text"
                                value={tier.minWeight}
                                onChange={(e) => handleWeightPriceChange(index, 'minWeight', e.target.value)}
                                className="w-full p-3 border-4 border-black bg-white text-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold mb-2 text-gray-700">
                                Cân nặng tối đa (kg)
                              </label>
                              <input
                                type="text"
                                value={tier.maxWeight}
                                onChange={(e) => handleWeightPriceChange(index, 'maxWeight', e.target.value)}
                                className="w-full p-3 border-4 border-black bg-white text-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                placeholder="10"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-bold mb-2 text-gray-700">
                                Phụ phí (VNĐ)
                              </label>
                              <input
                                type="text"
                                value={tier.price}
                                onChange={(e) => handleWeightPriceChange(index, 'price', e.target.value)}
                                className="w-full p-3 border-4 border-black bg-white text-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                placeholder="50000"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => setEditingTierIndex(null)}
                              className="px-4 py-2 bg-gray-200 border-2 border-black font-bold hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            >
                              Xong
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <div 
                                className="text-white px-3 py-1 border-2 border-black font-black"
                                style={{ backgroundColor: '#FF6B35' }}
                              >
                                MỨC {index + 1}
                              </div>
                              <div>
                                <div className="font-black text-lg text-gray-800">
                                  {tier.minWeight} - {tier.maxWeight} kg
                                </div>
                                <div className="text-sm text-gray-600">
                                  Phụ phí: <span className="font-bold text-green-600">
                                    +{Number(tier.price || 0).toLocaleString('vi-VN')}đ
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingTierIndex(index)}
                              className="p-2 border-2 border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                              style={{ backgroundColor: '#fb923c' }}
                              title="Chỉnh sửa"
                            >
                              <Edit2 size={18} className="text-black" />
                            </button>
                            <button
                              onClick={() => handleRemoveWeightPrice(index)}
                              className="p-2 border-2 border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                              style={{ backgroundColor: '#f87171' }}
                              title="Xóa"
                            >
                              <Trash2 size={18} className="text-black" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t-4 border-black p-4 bg-gray-50 flex justify-between items-center">
              <button
                onClick={handleAddWeightPrice}
                className="flex items-center gap-2 px-4 py-3 bg-green-500 text-white font-black border-4 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow uppercase"
              >
                <Plus size={20} />
                Thêm mốc giá
              </button>
              <button
                onClick={() => setShowWeightPriceModal(false)}
                className="px-6 py-3 text-white font-black border-4 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow uppercase"
                style={{ backgroundColor: '#FF6B35' }}
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
