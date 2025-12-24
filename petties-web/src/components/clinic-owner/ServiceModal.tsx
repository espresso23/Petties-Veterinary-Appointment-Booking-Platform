import React, { useEffect, useState } from 'react'
import {
  XMarkIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  InformationCircleIcon,
  ExclamationCircleIcon,
  MinusIcon,
  BeakerIcon,
  HeartIcon,
  ScissorsIcon,
  HomeIcon,
  ChevronDownIcon,
  ScaleIcon,
} from '@heroicons/react/24/solid'
import type { ClinicServiceResponse } from '../../types/service'
import type { WeightPriceDto } from '../../types/service'

interface ServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (service: any) => void
  initialData?: ClinicServiceResponse | null
  isSubmitting?: boolean
}

export function ServiceModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  isSubmitting = false,
}: ServiceModalProps) {
  const [name, setName] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [slotsRequired, setSlotsRequired] = useState(1)
  const [isHomeVisit, setIsHomeVisit] = useState(false)
  const [serviceCategory, setServiceCategory] = useState('')
  const [petType, setPetType] = useState('')
  const [customPetType, setCustomPetType] = useState('')
  const [weightPrices, setWeightPrices] = useState<WeightPriceDto[]>([])
  const [showWeightPriceModal, setShowWeightPriceModal] = useState(false)
  const [editingTierIndex, setEditingTierIndex] = useState<number | null>(null)
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [isPetTypeOpen, setIsPetTypeOpen] = useState(false)

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
      if (initialData) {
        setName(initialData.name)
        setBasePrice(initialData.basePrice.toString())
        setSlotsRequired(initialData.slotsRequired)
        setIsHomeVisit(initialData.isHomeVisit)
        setServiceCategory(initialData.serviceCategory || '')

        // Handle petType: check if it's predefined or custom
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

        setWeightPrices(initialData.weightPrices || [])
      } else {
        setName('')
        setBasePrice('')
        setSlotsRequired(1)
        setIsHomeVisit(false)
        setServiceCategory('')
        setPetType('')
        setCustomPetType('')
        setWeightPrices([])
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

    onSave({
      name,
      basePrice: Number(basePrice),
      slotsRequired: Number(slotsRequired),
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
          <h2 className="text-2xl font-black uppercase text-black">
            {initialData ? 'Cập nhật dịch vụ' : 'Thêm dịch vụ mới'}
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
            <div className="relative">
              <input
                type="text"
                required
                value={formatVNDInput(basePrice)}
                onChange={(e) => setBasePrice(e.target.value.replace(/\D/g, ''))}
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

          {/* Slots Configuration Card */}
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
                    Mỗi dịch vụ cần ít nhất 1 slot
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
                    Thời gian sẽ được tự động tính theo số slot bạn chọn
                  </li>
                </ul>
              </div>
            </div>
          </div>

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

            {/* Custom Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="w-full p-4 border-4 border-black bg-white flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
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

            {/* Custom Dropdown Menu */}
            {isCategoryOpen && (
              <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setServiceCategory(cat.id)
                      setIsCategoryOpen(false)
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
          </div>

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

            {/* Custom Dropdown Trigger */}
            <button
              type="button"
              onClick={() => setIsPetTypeOpen(!isPetTypeOpen)}
              className="w-full p-4 border-4 border-black bg-white flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
            >
              <span className={`font-bold ${selectedPetType ? 'text-black' : 'text-gray-400'}`}>
                {selectedPetType ? selectedPetType.label : '-- Chọn loại thú nuôi --'}
                {petType === 'Khác' && customPetType && ` (${customPetType})`}
              </span>
              <ChevronDownIcon
                className={`w-6 h-6 transition-transform duration-200 ${isPetTypeOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Custom Dropdown Menu */}
            {isPetTypeOpen && (
              <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                {petTypes.map((pet) => (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => {
                      setPetType(pet.id)
                      if (pet.id !== 'Khác') {
                        setCustomPetType('')
                      }
                      setIsPetTypeOpen(false)
                    }}
                    className={`w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors border-b-2 border-black last:border-b-0 text-left ${petType === pet.id ? 'bg-orange-50' : ''}`}
                  >
                    <span className={`font-black uppercase text-sm ${petType === pet.id ? 'text-[#FF6B35]' : 'text-black'}`}>
                      {pet.label}
                    </span>
                    {petType === pet.id && (
                      <div className="ml-auto w-3 h-3 bg-[#FF6B35] border-2 border-black rotate-45" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Custom Input for "Khác" */}
            {petType === 'Khác' && (
              <div className="mt-3">
                <label
                  style={{
                    fontWeight: '700',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    display: 'block',
                    color: '#4b5563',
                    marginBottom: '8px'
                  }}
                >
                  Nhập tên thú nuôi
                </label>
                <input
                  type="text"
                  value={customPetType}
                  onChange={(e) => setCustomPetType(e.target.value)}
                  className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
                  placeholder="Ví dụ: Thỏ, Hamster, Rùa..."
                  style={{
                    fontWeight: '700',
                    fontSize: '16px',
                    color: '#000000',
                    backgroundColor: '#ffffff'
                  }}
                />
              </div>
            )}
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
              <PencilIcon className="w-6 h-6 text-white" />
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
                  color: isHomeVisit ? '#000000' : '#4b5563'
                }}
              >
                {isHomeVisit ? 'Dịch vụ tận nhà' : 'Tại phòng khám'}
              </span>
              {!isHomeVisit && (
                <div className="ml-auto text-[10px] font-black bg-stone-200 px-2 py-0.5 border-2 border-black uppercase">
                  Mặc định
                </div>
              )}
            </label>
            <p
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#4b5563',
                paddingLeft: '8px',
                paddingRight: '8px'
              }}
            >
              Cho phép khách hàng đặt dịch vụ này tại nhà. Giá mỗi km được thiết lập ở phần "Định giá di chuyển" trong menu.
            </p>
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
                    Bảng giá cân nặng trống
                  </p>
                  <p className="text-base font-bold text-gray-500 max-w-sm mx-auto leading-relaxed">
                    Bạn chưa thiết lập mốc giá nào. Nhấn nút <span className="text-green-600">"Thêm mốc giá"</span> bên dưới để thiết lập phụ phí theo cân nặng cho thú cưng.
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
                                Phụ phí (VNĐ)
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
    </div>
  )
}
