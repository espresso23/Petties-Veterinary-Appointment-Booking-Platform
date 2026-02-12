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
  ChevronDownIcon,
  ScaleIcon,
  AdjustmentsHorizontalIcon,
  CheckIcon,
} from '@heroicons/react/24/solid'
import type { ClinicServiceResponse, VaccineDosePriceDTO } from '../../types/service'
import type { WeightPriceDto } from '../../types/service'
import { SERVICE_CATEGORIES, getCategoryById } from '../../constants/serviceCategory'
import { getAllVaccineTemplates, type VaccineTemplate } from '../../services/endpoints/vaccineTemplate'

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
  const [description, setDescription] = useState('')
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

  // Vaccine specific state
  const [vaccineTemplates, setVaccineTemplates] = useState<VaccineTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [dosePrices, setDosePrices] = useState<VaccineDosePriceDTO[]>([])
  const [reminderIntervalWeeks, setReminderIntervalWeeks] = useState<number>(3) // Default 3 weeks (21 days)

  // Quick Setup State
  const [doseCount, setDoseCount] = useState<number>(3)
  const [hasBooster, setHasBooster] = useState<boolean>(true)
  const [showDosePriceModal, setShowDosePriceModal] = useState(false)
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false)

  // Use centralized categories from constants
  const categories = SERVICE_CATEGORIES

  const petTypes = [
    { id: 'Chó', label: 'Chó' },
    { id: 'Mèo', label: 'Mèo' },
    { id: 'Cả chó và mèo', label: 'Cả chó và mèo' },
    { id: 'Khác', label: 'Khác (Tự nhập)' },
  ]

  const selectedCategory = getCategoryById(serviceCategory)
  const selectedPetType = petTypes.find(p => p.id === petType)

  useEffect(() => {
    // Load vaccine templates
    const loadTemplates = async () => {
      try {
        const data = await getAllVaccineTemplates()
        setVaccineTemplates(data)
      } catch (error) {
        console.error('Failed to load vaccine templates', error)
      }
    }
    loadTemplates()
  }, [])

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name)
        setDescription(initialData.description || '')
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

        // Vaccine fields
        setSelectedTemplateId(initialData.vaccineTemplateId || '')
        // Initialize dose setup state
        const initialDoses = initialData.dosePrices || []
        const booster = initialDoses.find(d => d.doseLabel.toLowerCase().includes('nhắc lại'))
        const regularDoses = initialDoses.filter(d => !d.doseLabel.toLowerCase().includes('nhắc lại'))

        setDoseCount(regularDoses.length > 0 ? regularDoses.length : 3)
        setHasBooster(!!booster)
        setDosePrices(initialData.dosePrices || [])

        // Load reminder interval (convert days to weeks)
        if (initialData.reminderInterval && initialData.reminderUnit === 'DAYS') {
          setReminderIntervalWeeks(Math.round(initialData.reminderInterval / 7))
        } else {
          setReminderIntervalWeeks(3)
        }

      } else {
        setName('')
        setDescription('')
        setBasePrice('')
        setSlotsRequired(1)
        setIsHomeVisit(false)
        setServiceCategory('')
        setPetType('')
        setCustomPetType('')
        setWeightPrices([])
        setSelectedTemplateId('')
        setDosePrices([])
        setReminderIntervalWeeks(3)
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

  const handleDosePriceChange = (index: number, field: keyof VaccineDosePriceDTO, value: string) => {
    const updated = [...dosePrices]
    if (field === 'price') {
      const numericValue = value.replace(/\D/g, '')
      updated[index] = { ...updated[index], [field]: numericValue === '' ? 0 : Number(numericValue) }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setDosePrices(updated)
  }

  const handleQuickGenerateDoses = () => {
    const newDoses: VaccineDosePriceDTO[] = []

    // Generate regular doses
    for (let i = 1; i <= doseCount; i++) {
      // Try to preserve existing price if available
      const existing = dosePrices.find(d => d.doseNumber === i && !d.doseLabel.includes('nhắc lại'))
      newDoses.push({
        doseNumber: i,
        doseLabel: `Mũi ${i}`,
        price: existing ? existing.price : (basePrice ? Number(basePrice) : 0),
        isActive: true
      })
    }

    // Generate booster if checked
    if (hasBooster) {
      const existingBooster = dosePrices.find(d => d.doseLabel.includes('nhắc lại'))
      newDoses.push({
        doseNumber: doseCount + 1,
        doseLabel: 'Tiêm nhắc lại (Hằng năm)',
        price: existingBooster ? existingBooster.price : (basePrice ? Number(basePrice) : 0),
        isActive: true
      })
    }

    setDosePrices(newDoses)
  }

  const handleAddDose = () => {
    const nextDoseNumber = dosePrices.length + 1
    const newDose: VaccineDosePriceDTO = {
      doseNumber: nextDoseNumber,
      doseLabel: `Mũi ${nextDoseNumber}`,
      price: basePrice ? Number(basePrice) : 0,
      isActive: true
    }
    setDosePrices([...dosePrices, newDose])
  }

  const handleRemoveDose = (index: number) => {
    const updated = dosePrices.filter((_, i) => i !== index)
    setDosePrices(updated)
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
      description: description || undefined,
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
      vaccineTemplateId: selectedTemplateId || undefined,
      dosePrices: dosePrices.length > 0 ? dosePrices : undefined,
      // Save reminder interval (Days = Weeks * 7) if custom vaccine
      reminderInterval: (!selectedTemplateId && serviceCategory === 'VACCINATION') ? (reminderIntervalWeeks * 7) : undefined,
      reminderUnit: (!selectedTemplateId && serviceCategory === 'VACCINATION') ? 'DAYS' : undefined
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
          <h2 className="text-[21px] font-black uppercase text-black">
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
          {/* Service Category - Moved to Top */}
          <div className="space-y-2 relative z-20">
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
                      <selectedCategory.icon className="w-5 h-5" style={{ color: selectedCategory.textColor }} />
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
                      // Reset vaccine template when changing category
                      if (cat.id !== 'VACCINATION') {
                        setSelectedTemplateId('')
                      }
                    }}
                    className={`w-full p-4 flex items-center gap-4 hover:bg-gray-100 transition-colors border-b-2 border-black last:border-b-0 text-left ${serviceCategory === cat.id ? 'bg-orange-50' : ''}`}
                  >
                    <div
                      className="p-2 border-2 border-black"
                      style={{ backgroundColor: cat.color }}
                    >
                      <cat.icon className="w-5 h-5" style={{ color: cat.textColor }} />
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
          {/* Vaccine Template Selection */}
          {serviceCategory === 'VACCINATION' && (
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
                Chọn mẫu vắc-xin
              </label>

              <button
                type="button"
                onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                className="w-full p-4 border-4 border-black bg-white flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                <span className={`font-bold ${selectedTemplateId ? 'text-black' : 'text-gray-400'}`}>
                  {selectedTemplateId
                    ? vaccineTemplates.find(t => t.id === selectedTemplateId)?.name
                    : 'Tự nhập (Custom)'}
                </span>
                <ChevronDownIcon
                  className={`w-6 h-6 transition-transform duration-200 ${isTemplateDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isTemplateDropdownOpen && (
                <div className="absolute z-10 top-full left-0 right-0 mt-2 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden max-h-[300px] overflow-y-auto">
                  {/* Option: Custom */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId('')
                      setIsTemplateDropdownOpen(false)
                    }}
                    className={`w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors border-b-2 border-black text-left ${selectedTemplateId === '' ? 'bg-orange-50' : ''}`}
                  >
                    <span className={`font-black uppercase text-sm ${selectedTemplateId === '' ? 'text-[#FF6B35]' : 'text-black'}`}>
                      Tự nhập (Custom)
                    </span>
                  </button>

                  {vaccineTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(template.id)
                        setIsTemplateDropdownOpen(false)

                        // Auto-fill form
                        setName(template.name)
                        if (template.defaultPrice) {
                          setBasePrice(template.defaultPrice.toString())
                        }
                        // Pet type
                        if (template.targetSpecies === 'DOG') setPetType('Chó')
                        else if (template.targetSpecies === 'CAT') setPetType('Mèo')

                        else if (template.targetSpecies === 'BOTH') setPetType('Cả chó và mèo')

                        // Auto-generate dose prices based on template specs
                        const newDosePrices: VaccineDosePriceDTO[] = []
                        const doses = template.seriesDoses || 1
                        const price = template.defaultPrice || 0

                        for (let i = 1; i <= doses; i++) {
                          newDosePrices.push({
                            doseNumber: i,
                            doseLabel: `Mũi ${i}`,
                            price: price,
                            isActive: true
                          })
                        }
                        if (template.isAnnualRepeat) {
                          newDosePrices.push({
                            doseNumber: 4,
                            doseLabel: 'Tiêm nhắc lại (Hằng năm)',
                            price: price,
                            isActive: true
                          })
                        }

                        // Update setup state
                        setDoseCount(doses)
                        setHasBooster(!!template.isAnnualRepeat)

                        setDosePrices(newDosePrices)
                      }}
                      className={`w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors border-b-2 border-black last:border-b-0 text-left ${selectedTemplateId === template.id ? 'bg-orange-50' : ''}`}
                    >
                      <div>
                        <span className={`font-black uppercase text-sm ${selectedTemplateId === template.id ? 'text-[#FF6B35]' : 'text-black'}`}>
                          {template.name}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {template.manufacturer} • {template.targetSpecies}
                        </div>
                      </div>
                      {selectedTemplateId === template.id && (
                        <div className="ml-auto w-3 h-3 bg-[#FF6B35] border-2 border-black rotate-45" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

          )}



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
              Mô tả dịch vụ
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-3 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow resize-none"
              placeholder="Mô tả chi tiết về dịch vụ..."
              style={{
                fontWeight: '700',
                fontSize: '16px',
                color: '#000000',
                backgroundColor: '#ffffff'
              }}
            />
          </div>

          {serviceCategory !== 'VACCINATION' && (
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
                  đ
                </div>
              </div>
            </div>
          )}

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
              {serviceCategory === 'VACCINATION' ? 'Giá theo mũi tiêm (Bắt buộc)' : 'Giá theo cân nặng (Tùy chọn)'}
            </label>

            {serviceCategory === 'VACCINATION' ? (
              <button
                type="button"
                onClick={() => setShowDosePriceModal(true)}
                className="w-full p-4 border-4 border-black hover:bg-opacity-90 transition-colors font-bold text-left flex justify-between items-center"
                style={{
                  backgroundColor: '#FF6B35'
                }}
              >
                <div>
                  <div className="text-lg font-black text-white">
                    {dosePrices.length === 0 ? 'Chưa thiết lập giá mũi tiêm' : `${dosePrices.length} mũi tiêm đã thiết lập`}
                  </div>
                  <div className="text-sm text-white opacity-80 mt-1">
                    Click để thiết lập giá từng mũi
                  </div>
                </div>
                <PencilIcon className="w-6 h-6 text-white" />
              </button>
            ) : (
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
            )}

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
                {isHomeVisit ? 'Dịch vụ tại nhà' : 'Tại phòng khám'}
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
          {/* ... Existing Weight Modal Content ... */}
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

      {/* Dose Price Modal */}
      {showDosePriceModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowDosePriceModal(false)}
        >
          <div
            className="bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="border-b-4 border-black p-4 flex justify-between items-center"
              style={{ backgroundColor: '#FF6B35' }}
            >
              <h3 className="text-2xl font-black text-white uppercase flex items-center gap-2">
                <InformationCircleIcon className="w-7 h-7 text-white" />
                Quản lý giá theo mũi tiêm
              </h3>
              <button
                onClick={() => setShowDosePriceModal(false)}
                className="w-10 h-10 flex items-center justify-center bg-black text-white border-2 border-white hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* Quick Setup Section */}
              <div className="bg-orange-50 p-4 border-2 border-dashed border-[#FF6B35]">
                <h4 className="font-black uppercase text-[#FF6B35] mb-3 flex items-center gap-2">
                  <AdjustmentsHorizontalIcon className="w-5 h-5" />
                  Thiết lập nhanh
                </h4>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-black uppercase text-gray-500 mb-1">
                      Số mũi trong liệu trình
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={doseCount}
                      onChange={(e) => setDoseCount(Number(e.target.value))}
                      className="w-full p-2 border-2 border-black font-bold focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div className={`w-6 h-6 border-2 border-black flex items-center justify-center transition-colors ${hasBooster ? 'bg-black' : 'bg-white'}`}>
                        {hasBooster && <CheckIcon className="w-4 h-4 text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={hasBooster}
                        onChange={(e) => setHasBooster(e.target.checked)}
                      />
                      <span className="font-bold text-sm">Có mũi nhắc lại (Hằng năm)</span>
                    </label>
                  </div>
                  <button
                    onClick={handleQuickGenerateDoses}
                    className="px-4 py-2 bg-black text-white font-bold border-2 border-black hover:bg-gray-800 transition-all uppercase text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>

              {dosePrices.length === 0 ? (
                <div className="text-center py-16 px-8 border-4 border-dashed border-gray-300 bg-gray-50/50">
                  <p className="text-2xl font-black text-black uppercase mb-3">
                    Chưa có thông tin mũi tiêm
                  </p>
                  <p className="text-base font-bold text-gray-500 max-w-sm mx-auto leading-relaxed">
                    Vui lòng chọn mẫu vắc-xin để tự động tạo danh sách mũi tiêm.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dosePrices.map((dose, index) => (
                    <div key={index} className="border-4 border-black p-5 bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-12 h-12 border-2 border-black bg-[#e0f2fe] flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            <span className="font-black text-lg">{dose.doseNumber}</span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={dose.doseLabel}
                                onChange={(e) => handleDosePriceChange(index, 'doseLabel', e.target.value)}
                                className="font-black text-lg text-black uppercase bg-transparent border-b border-gray-300 focus:border-black outline-none w-full"
                              />
                            </div>
                            <div className="text-xs text-gray-500 font-bold">Giá mặc định: {dose.price ? dose.price.toLocaleString('vi-VN') : 0} đ</div>
                          </div>
                        </div>

                        <div className="w-[180px]">
                          <label className="block text-xs font-black uppercase text-gray-50 mb-1 opacity-0">
                            Giá
                          </label>
                          <input
                            type="text"
                            value={formatVNDInput(dose.price.toString())}
                            onChange={(e) => handleDosePriceChange(index, 'price', e.target.value)}
                            className="w-full p-2 border-2 border-black bg-white text-black font-bold focus:bg-orange-50 outline-none"
                            placeholder="0"
                          />
                        </div>

                        <button
                          onClick={() => handleRemoveDose(index)}
                          className="w-10 h-10 flex items-center justify-center border-2 border-black bg-[#ffcdd2] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all ml-2"
                          title="Xóa"
                        >
                          <TrashIcon className="w-5 h-5 text-black" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t-4 border-black p-4 bg-gray-50 flex justify-between items-center">
              <button
                onClick={handleAddDose}
                className="flex items-center gap-2 px-4 py-3 bg-[#c8e6c9] text-black font-black border-4 border-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all uppercase"
              >
                <PlusIcon className="w-5 h-5" />
                Thêm mũi tiêm
              </button>
              <button
                onClick={() => setShowDosePriceModal(false)}
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
