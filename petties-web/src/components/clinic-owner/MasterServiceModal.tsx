import React, { useEffect, useState } from 'react'
import {
  XMarkIcon,
  MinusIcon,
  PlusIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
  ChevronDownIcon,
  TrashIcon,
  PencilIcon,
  InformationCircleIcon,
  BeakerIcon,
  HeartIcon,
  ScissorsIcon,
  HomeIcon,
  ScaleIcon,
} from '@heroicons/react/24/solid'
import type { MasterServiceResponse, WeightPriceDto } from '../../types/service'

interface MasterServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (service: any) => void
  initialData?: MasterServiceResponse | null
  isSubmitting?: boolean
}

export function MasterServiceModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  isSubmitting = false,
}: MasterServiceModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [defaultPrice, setDefaultPrice] = useState('')
  const [slotsRequired, setSlotsRequired] = useState(1)
  const [serviceCategory, setServiceCategory] = useState('')
  const [petType, setPetType] = useState('')
  const [customPetType, setCustomPetType] = useState('')
  const [weightPrices, setWeightPrices] = useState<WeightPriceDto[]>([])
  const [showWeightPriceModal, setShowWeightPriceModal] = useState(false)
  const [editingTierIndex, setEditingTierIndex] = useState<number | null>(null)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isPetTypeOpen, setIsPetTypeOpen] = useState(false)
  const [isHomeVisit, setIsHomeVisit] = useState(false)
  const [errors, setErrors] = useState<{
    serviceCategory?: string
    petType?: string
  }>({})

  const categories = [
    { id: 'Y Tế & Chăm Sóc Sức Khỏe', label: 'Y Tế & Chăm Sóc Sức Khỏe', icon: BeakerIcon, color: '#e0f2fe' },
    { id: 'Chăm sóc sức khỏe chuyên sâu', label: 'Chăm sóc sức khỏe chuyên sâu', icon: HeartIcon, color: '#fef2f2' },
    { id: 'Tiêm phòng', label: 'Tiêm phòng', icon: BeakerIcon, color: '#ecfdf5' },
    { id: 'Làm Đẹp (Grooming) & Spa', label: 'Làm Đẹp (Grooming) & Spa', icon: ScissorsIcon, color: '#f5f3ff' },
    { id: 'Trông Giữ & Lưu Trú', label: 'Trông Giữ & Lưu Trú', icon: HomeIcon, color: '#fffbeb' },
  ]

  const petTypes = [
    { id: 'Chó', label: 'Chó' },
    { id: 'Mèo', label: 'Mèo' },
    { id: 'Khác', label: 'Khác (Tự nhập)' },
  ]

  const selectedCategory = categories.find(c => c.id === serviceCategory)
  const selectedPetType = petTypes.find(p => p.id === petType)

  useEffect(() => {
    if (isOpen) {
      setErrors({})
      if (initialData) {
        setName(initialData.name)
        setDescription(initialData.description || '')
        setDefaultPrice(initialData.defaultPrice.toString())
        setSlotsRequired(initialData.slotsRequired)
        setServiceCategory(initialData.serviceCategory || '')
        setWeightPrices(initialData.weightPrices || [])
        setIsHomeVisit(initialData.isHomeVisit || false)

        // Handle petType
        const predefinedPet = petTypes.find(p => p.id === initialData.petType)
        if (predefinedPet) {
          setPetType(initialData.petType || '')
          setCustomPetType('')
        } else if (initialData.petType) {
          setPetType('Khác')
          setCustomPetType(initialData.petType)
        } else {
          setPetType('')
          setCustomPetType('')
        }
      } else {
        setName('')
        setDescription('')
        setDefaultPrice('')
        setSlotsRequired(1)
        setServiceCategory('')
        setPetType('')
        setCustomPetType('')
        setWeightPrices([])
        setIsHomeVisit(false)
      }
    }
  }, [isOpen, initialData])

  const handleAddWeightPrice = () => {
    setWeightPrices([...weightPrices, { minWeight: 0, maxWeight: 0, price: 0 }])
  }

  const handleRemoveWeightPrice = (index: number) => {
    setWeightPrices(weightPrices.filter((_, i) => i !== index))
  }

  const handleWeightPriceChange = (index: number, field: keyof WeightPriceDto, value: string) => {
    const updated = [...weightPrices]
    if (field === 'price') {
      const numericValue = value.replace(/\D/g, '')
      updated[index] = { ...updated[index], [field]: numericValue === '' ? 0 : Number(numericValue) }
    } else {
      updated[index] = { ...updated[index], [field]: value === '' ? 0 : Number(value) }
    }
    setWeightPrices(updated)
  }

  const formatVNDInput = (value: string) => {
    if (!value) return ''
    const numeric = value.replace(/\D/g, '')
    if (!numeric) return ''
    return new Intl.NumberFormat('vi-VN').format(Number(numeric))
  }

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    // Validation
    const newErrors: { serviceCategory?: string; petType?: string } = {}

    if (!serviceCategory) {
      newErrors.serviceCategory = 'Vui lòng chọn loại dịch vụ'
    }

    if (!petType) {
      newErrors.petType = 'Vui lòng chọn loại thú nuôi'
    }

    if (petType === 'Khác' && !customPetType.trim()) {
      newErrors.petType = 'Vui lòng nhập loại thú nuôi'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})

    onSave({
      name,
      description: description || undefined,
      defaultPrice: Number(defaultPrice),
      slotsRequired: Number(slotsRequired),
      durationTime: Number(slotsRequired) * 30,
      isHomeVisit,
      serviceCategory: serviceCategory || undefined,
      petType: petType === 'Khác' ? (customPetType || undefined) : (petType || undefined),
      weightPrices: weightPrices.length > 0 ? weightPrices.map(wp => ({
        minWeight: Number(wp.minWeight),
        maxWeight: Number(wp.maxWeight),
        price: Number(wp.price)
      })) : undefined,
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
          <h2 className="text-2xl font-black uppercase text-white">
            {initialData ? 'CẬP NHẬT DỊCH VỤ MẪU' : 'TẠO DỊCH VỤ MẪU MỚI'}
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-black text-white border-2 border-black hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.4)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1">
          {/* Tên dịch vụ */}
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

          {/* Mô tả */}
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
              Mô tả dịch vụ (tùy chọn)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow min-h-[100px]"
              placeholder="Mô tả chi tiết về dịch vụ này..."
              style={{
                fontWeight: '700',
                fontSize: '16px',
                color: '#000000',
                backgroundColor: '#ffffff'
              }}
            />
          </div>

          {/* Giá mặc định */}
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
            <div className="relative">
              <input
                type="text"
                required
                value={formatVNDInput(defaultPrice)}
                onChange={(e) => setDefaultPrice(e.target.value.replace(/\D/g, ''))}
                className="w-full p-3 pr-16 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                placeholder="Ví dụ: 150.000"
                style={{
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-400">
                VNĐ
              </div>
            </div>
          </div>

          {/* Dịch vụ tới nhà */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  checked={isHomeVisit}
                  onChange={(e) => setIsHomeVisit(e.target.checked)}
                  className="w-6 h-6 border-4 border-black accent-green-600"
                />
                <span
                  style={{
                    fontWeight: '900',
                    fontSize: '18px',
                    textTransform: 'uppercase',
                    color: '#000000'
                  }}
                >
                  Dịch vụ tại nhà
                </span>
              </label>

              {/* Inline-styled Config button per user request */}
              {/* Config button removed per request */}

              {/* Small toggle button to mark as home service (inline styles) */}
              <button
                type="button"
                onClick={() => setIsHomeVisit(!isHomeVisit)}
                style={{
                  backgroundColor: isHomeVisit ? '#10b981' : '#fcd34d',
                  color: '#000000'
                }}
                className="p-2 border-2 border-black transition-colors hover:opacity-80 flex items-center gap-1"
                title={isHomeVisit ? "Chuyển thành dịch vụ tại phòng khám" : "Chuyển thành dịch vụ tại nhà"}
              >
                <HomeIcon className="w-4 h-4" />
                <span className="text-xs font-black uppercase" style={{ color: '#000000' }}>{isHomeVisit ? 'Tại nhà' : 'Tại phòng khám'}</span>
              </button>
            </div>
            {isHomeVisit && (
              <div className="ml-9 space-y-2">
                <p className="text-sm text-gray-600 font-bold">
                  Giá mỗi km sẽ được config riêng khi áp dụng cho từng phòng khám
                </p>
              </div>
            )}
          </div>

          {/* Slots Configuration */}
          <div className="p-6 border-4 border-black bg-orange-50/30 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4">
            <label
              style={{
                fontWeight: '900',
                fontSize: '16px',
                textTransform: 'uppercase',
                display: 'block',
                color: '#000000',
              }}
            >
              Số slot thực hiện (1 slot = 30 phút)
            </label>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={() => setSlotsRequired(Math.max(1, slotsRequired - 1))}
                  className="w-12 h-12 flex items-center justify-center bg-[#ffcdd2] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#ef9a9a]"
                  disabled={slotsRequired <= 1}
                >
                  <MinusIcon className="w-6 h-6 text-black" />
                </button>

                <div className="w-24 h-14 border-4 border-black bg-white flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-3xl font-black text-[#FF6B35]">{slotsRequired}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSlotsRequired(slotsRequired + 1)}
                  className="w-12 h-12 flex items-center justify-center bg-[#c8e6c9] border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all hover:bg-[#a5d6a7]"
                >
                  <PlusIcon className="w-6 h-6 text-black" />
                </button>
              </div>

              <div className="text-sm font-bold text-gray-600 bg-white border-2 border-black py-1 px-4 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                Tổng thời gian dự kiến: <span className="text-[#FF6B35] font-black">{slotsRequired * 30} phút</span>
              </div>
            </div>

            <div className="p-4 bg-[#fff9c4] border-4 border-black flex items-start gap-3">
              <ExclamationCircleIcon className="w-6 h-6 text-amber-700 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-black text-amber-900 text-sm uppercase">Quy tắc tính thời gian</p>
                <ul className="text-xs font-bold text-amber-800 space-y-1">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
                    Hệ thống Petties sử dụng cơ chế chia Slot (30 phút/slot)
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
                    Đây là dịch vụ mẫu - phòng khám có thể thừa hưởng và điều chỉnh
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Loại dịch vụ */}
          <div className="space-y-2 relative">
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

            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className={`w-full p-4 border-4 border-black bg-white flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all ${errors.serviceCategory ? 'border-red-500' : ''
                }`}
            >
              <div className="flex items-center gap-3">
                {selectedCategory ? (
                  <>
                    <div
                      className="p-2 border-2 border-black"
                      style={{ backgroundColor: selectedCategory.color }}
                    >
                      <selectedCategory.icon className="w-5 h-5 text-black" />
                    </div>
                    <span className="font-bold text-black">{selectedCategory.label}</span>
                  </>
                ) : (
                  <span className="font-bold text-gray-400">-- Chọn loại dịch vụ --</span>
                )}
              </div>
              <ChevronDownIcon
                className={`w-6 h-6 transition-transform duration-200 ${isCategoryOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isCategoryOpen && (
              <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setServiceCategory(cat.id)
                      setIsCategoryOpen(false)
                      setErrors(prev => ({ ...prev, serviceCategory: undefined }))
                    }}
                    className={`w-full p-4 flex items-center gap-4 hover:bg-gray-100 transition-colors border-b-2 border-black last:border-b-0 text-left ${serviceCategory === cat.id ? 'bg-orange-50' : ''}`}
                  >
                    <div
                      className="p-2 border-2 border-black"
                      style={{ backgroundColor: cat.color }}
                    >
                      <cat.icon className="w-5 h-5 text-black" />
                    </div>
                    <span className={`font-black uppercase text-sm ${serviceCategory === cat.id ? 'text-[#FF6B35]' : 'text-black'}`}>
                      {cat.label}
                    </span>
                    {serviceCategory === cat.id && (
                      <div className="ml-auto w-3 h-3 bg-[#FF6B35] border-2 border-black rotate-45" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {errors.serviceCategory && (
              <p className="text-sm font-bold text-red-600 mt-2 flex items-center gap-1">
                <ExclamationCircleIcon className="w-4 h-4" />
                {errors.serviceCategory}
              </p>
            )}          </div>

          {/* Loại thú nuôi */}
          <div className="space-y-2 relative">
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

            <button
              type="button"
              onClick={() => setIsPetTypeOpen(!isPetTypeOpen)}
              className={`w-full p-4 border-4 border-black bg-white flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all ${errors.petType ? 'border-red-500' : ''
                }`}
            >
              <span className={`font-bold ${selectedPetType ? 'text-black' : 'text-gray-400'}`}>
                {selectedPetType ? selectedPetType.label : '-- Chọn loại thú nuôi --'}
                {petType === 'Khác' && customPetType && ` (${customPetType})`}
              </span>
              <ChevronDownIcon
                className={`w-6 h-6 transition-transform duration-200 ${isPetTypeOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isPetTypeOpen && (
              <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {petTypes.map((pet) => (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => {
                      setPetType(pet.id)
                      setIsPetTypeOpen(false)
                      if (pet.id !== 'Khác') {
                        setCustomPetType('')
                      }
                      setErrors(prev => ({ ...prev, petType: undefined }))
                    }}
                    className={`w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors border-b-2 border-black last:border-b-0 text-left ${petType === pet.id ? 'bg-orange-50' : ''}`}
                  >
                    <span className={`font-black uppercase text-sm ${petType === pet.id ? 'text-[#FF6B35]' : 'text-black'}`}>
                      {pet.label}
                    </span>
                    {petType === pet.id && (
                      <div className="w-3 h-3 bg-[#FF6B35] border-2 border-black rotate-45" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {errors.petType && (
              <p className="text-sm font-bold text-red-600 mt-2 flex items-center gap-1">
                <ExclamationCircleIcon className="w-4 h-4" />
                {errors.petType}
              </p>
            )}
          </div>

          {/* Custom Pet Type Input */}
          {petType === 'Khác' && (
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
                Nhập loại thú nuôi
              </label>
              <input
                type="text"
                value={customPetType}
                onChange={(e) => {
                  setCustomPetType(e.target.value)
                  if (e.target.value.trim()) {
                    setErrors(prev => ({ ...prev, petType: undefined }))
                  }
                }}
                className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                placeholder="Ví dụ: Hamster, Chim, Bò sát..."
                style={{
                  fontWeight: '700',
                  fontSize: '16px',
                  color: '#000000',
                  backgroundColor: '#ffffff'
                }}
              />
            </div>
          )}

          {/* Weight-based Pricing */}
          <div className="space-y-3">
            <div>
              <label
                style={{
                  fontWeight: '900',
                  fontSize: '18px',
                  textTransform: 'uppercase',
                  color: '#000000',
                  display: 'block'
                }}
              >
                Phụ phí theo cân nặng (Tùy chọn)
              </label>
              <p className="text-sm font-bold text-gray-600 mt-1">
                Phụ phí này sẽ được cộng thêm vào giá cơ bản ({defaultPrice ? new Intl.NumberFormat('vi-VN').format(Number(defaultPrice)) : '0'} VNĐ)
              </p>
            </div>

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
                  {weightPrices.length === 0 ? 'Chưa có mốc phụ phí theo cân nặng' : `${weightPrices.length} mốc phụ phí đã thiết lập`}
                </div>
                <div className="text-sm text-white opacity-80 mt-1">
                  Click để quản lý bảng phụ phí theo cân nặng

                </div>
              </div>
              <PencilIcon className="w-6 h-6 text-white" />
            </button>
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
              {isSubmitting && <ArrowPathIcon className="w-5 h-5 animate-spin" />}
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
                <InformationCircleIcon className="w-7 h-7 text-white" />
                Quản lý giá theo cân nặng
              </h3>
              <button
                onClick={() => setShowWeightPriceModal(false)}
                className="w-10 h-10 flex items-center justify-center bg-black text-white border-2 border-white hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {weightPrices.length === 0 ? (
                <div className="text-center py-16 px-8 border-4 border-dashed border-gray-300 bg-gray-50/50">
                  <div className="flex justify-center mb-6">
                    <div className="p-6 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                      <ScaleIcon className="w-12 h-12 text-[#FF6B35]" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-black uppercase mb-3">
                    Bảng phụ phí cân nặng trống
                  </p>
                  <p className="text-base font-bold text-gray-500 max-w-sm mx-auto leading-relaxed">
                    Bạn chưa thiết lập mốc phụ phí nào. Nhấn nút <span className="text-green-600">"Thêm mốc giá"</span> bên dưới để thiết lập phụ phí cộng thêm theo cân nặng cho thú cưng.

                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {weightPrices.map((tier, index) => (
                    <div
                      key={index}
                      className="border-4 border-black p-5 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                      {editingTierIndex === index ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 mb-2">
                            <PencilIcon className="w-5 h-5 text-[#FF6B35]" />
                            <span className="font-black uppercase text-sm">Đang chỉnh sửa mức {index + 1}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <label className="block text-xs font-black uppercase text-gray-500">
                                Min (kg)
                              </label>
                              <input
                                type="number"
                                value={tier.minWeight}
                                onChange={(e) => handleWeightPriceChange(index, 'minWeight', e.target.value)}
                                className="w-full p-2 border-2 border-black bg-white text-black font-bold focus:bg-orange-50 outline-none"
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-black uppercase text-gray-500">
                                Max (kg)
                              </label>
                              <input
                                type="number"
                                value={tier.maxWeight}
                                onChange={(e) => handleWeightPriceChange(index, 'maxWeight', e.target.value)}
                                className="w-full p-2 border-2 border-black bg-white text-black font-bold focus:bg-orange-50 outline-none"
                                placeholder="10"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-xs font-black uppercase text-gray-500">
                                Phụ phí cộng thêm (VNĐ)

                              </label>
                              <input
                                type="text"
                                value={formatVNDInput(tier.price.toString())}
                                onChange={(e) => handleWeightPriceChange(index, 'price', e.target.value)}
                                className="w-full p-2 border-2 border-black bg-white text-black font-bold focus:bg-orange-50 outline-none"
                                placeholder="50.000"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={() => setEditingTierIndex(null)}
                              className="px-6 py-2 bg-black text-white font-black uppercase text-xs border-2 border-black hover:bg-gray-800 transition-colors"
                            >
                              Hoàn thành
                            </button>
                          </div>
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 border-2 border-black bg-[#e0f2fe] flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              <ScaleIcon className="w-5 h-5 text-black" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-black text-xs uppercase bg-black text-white px-2 py-0.5">Mức {index + 1}</span>
                                <span className="font-black text-lg text-black">{tier.minWeight} - {tier.maxWeight} kg</span>
                              </div>
                              <div className="text-sm font-bold text-gray-600">
                                Phụ phí cộng thêm: <span className="text-green-600 font-black">+{Number(tier.price || 0).toLocaleString('vi-VN')} VNĐ</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingTierIndex(index)}
                              className="w-10 h-10 flex items-center justify-center border-2 border-black bg-[#fff9c4] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                              title="Chỉnh sửa"
                            >
                              <PencilIcon className="w-5 h-5 text-black" />
                            </button>
                            <button
                              onClick={() => handleRemoveWeightPrice(index)}
                              className="w-10 h-10 flex items-center justify-center border-2 border-black bg-[#ffcdd2] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                              title="Xóa"
                            >
                              <TrashIcon className="w-5 h-5 text-black" />
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
                className="flex items-center gap-2 px-4 py-3 bg-[#c8e6c9] text-black font-black border-4 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all uppercase"
              >
                <PlusIcon className="w-5 h-5" />
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
      {/* Home Visit Config Modal (simple placeholder) */}
      {/* Home config modal removed */}
    </div>
  )
}
