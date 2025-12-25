import { useState, useEffect } from 'react'
import {
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/solid'
import type { MasterServiceResponse } from '../../types/service'
import { getAllMasterServices } from '../../services/endpoints/masterService'

interface InheritServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onInherit: (masterServiceId: string, clinicPrice?: number) => void
  isSubmitting?: boolean
}

export function InheritServiceModal({
  isOpen,
  onClose,
  onInherit,
  isSubmitting = false,
}: InheritServiceModalProps) {
  const [masterServices, setMasterServices] = useState<MasterServiceResponse[]>([])
  const [filteredServices, setFilteredServices] = useState<MasterServiceResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedService, setSelectedService] = useState<MasterServiceResponse | null>(null)
  const [customPrice, setCustomPrice] = useState('')
  const [useCustomPrice, setUseCustomPrice] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadMasterServices()
      setSearchTerm('')
      setSelectedService(null)
      setCustomPrice('')
      setUseCustomPrice(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (searchTerm) {
      const filtered = masterServices.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredServices(filtered)
    } else {
      setFilteredServices(masterServices)
    }
  }, [searchTerm, masterServices])

  const loadMasterServices = async () => {
    try {
      setIsLoading(true)
      const data = await getAllMasterServices()
      setMasterServices(data)
      setFilteredServices(data)
    } catch (error) {
      console.error('Failed to load master services:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const formatVNDInput = (value: string) => {
    if (!value) return ''
    const numeric = value.replace(/\D/g, '')
    if (!numeric) return ''
    return new Intl.NumberFormat('vi-VN').format(Number(numeric))
  }

  const handleInherit = () => {
    if (!selectedService) return
    
    const price = useCustomPrice && customPrice ? Number(customPrice) : undefined
    onInherit(selectedService.masterServiceId, price)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div
        className="relative w-full max-w-3xl bg-white border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ backgroundColor: '#10b981' }}
          className="flex items-center justify-between border-b-4 border-black p-6"
        >
          <h2 className="text-2xl font-black uppercase text-white">
            THỪA HƯỞNG DỊCH VỤ MẪU
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-black text-white border-2 border-black hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(255,255,255,0.4)] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px]"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b-4 border-black bg-gray-50">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm dịch vụ mẫu..."
              className="w-full p-3 pl-12 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
              style={{
                fontWeight: '700',
                fontSize: '16px',
                color: '#000000',
                backgroundColor: '#ffffff'
              }}
            />
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>
        </div>

        {/* Services List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 animate-spin text-black" />
              <span className="ml-3 font-black text-gray-600">Đang tải...</span>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl font-black uppercase text-gray-400">
                Không tìm thấy dịch vụ mẫu
              </p>
            </div>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service.masterServiceId}
                onClick={() => setSelectedService(service)}
                className={`p-5 border-4 border-black cursor-pointer transition-all ${
                  selectedService?.masterServiceId === service.masterServiceId
                    ? 'bg-green-100 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-black uppercase">
                        {service.name}
                      </h3>
                      {selectedService?.masterServiceId === service.masterServiceId && (
                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                    
                    {service.description && (
                      <p className="text-sm font-bold text-gray-600 mb-3">
                        {service.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs font-black text-gray-500 uppercase">Giá mặc định</span>
                        <p className="font-black text-lg text-green-600">
                          {service.defaultPrice.toLocaleString('vi-VN')} VNĐ
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-black text-gray-500 uppercase">Thời gian</span>
                        <p className="font-black text-lg">
                          {service.durationTime} phút
                        </p>
                      </div>
                      {service.serviceCategory && (
                        <div>
                          <span className="text-xs font-black text-gray-500 uppercase">Loại dịch vụ</span>
                          <p className="font-bold text-sm">
                            {service.serviceCategory}
                          </p>
                        </div>
                      )}
                      {service.petType && (
                        <div>
                          <span className="text-xs font-black text-gray-500 uppercase">Thú cưng</span>
                          <p className="font-bold text-sm">
                            {service.petType}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Custom Price Section */}
        {selectedService && (
          <div className="p-6 border-t-4 border-black bg-amber-50">
            <div className="flex items-center gap-4 mb-4">
              <input
                type="checkbox"
                id="useCustomPrice"
                checked={useCustomPrice}
                onChange={(e) => setUseCustomPrice(e.target.checked)}
                className="w-5 h-5 border-4 border-black"
              />
              <label
                htmlFor="useCustomPrice"
                className="cursor-pointer"
                style={{
                  fontWeight: '900',
                  fontSize: '16px',
                  textTransform: 'uppercase',
                  color: '#000000'
                }}
              >
                Ghi đè giá riêng cho phòng khám này
              </label>
            </div>

            {useCustomPrice && (
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
                  Giá tùy chỉnh (VNĐ)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatVNDInput(customPrice)}
                    onChange={(e) => setCustomPrice(e.target.value.replace(/\D/g, ''))}
                    placeholder={`Giá mặc định: ${selectedService.defaultPrice.toLocaleString('vi-VN')}`}
                    className="w-full p-3 pr-16 border-4 border-black focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow"
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
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex gap-4 p-6 border-t-4 border-black bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 p-4 border-4 border-black bg-white font-black uppercase hover:bg-gray-100 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-x-1 active:translate-y-1"
            disabled={isSubmitting}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleInherit}
            disabled={!selectedService || isSubmitting}
            className="flex-1 p-4 border-4 border-black bg-green-600 text-white font-black uppercase hover:bg-green-700 transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none active:translate-x-1 active:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Đang thừa hưởng...
              </span>
            ) : (
              'Thừa hưởng dịch vụ'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
