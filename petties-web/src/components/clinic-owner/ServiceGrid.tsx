/**
 * ServiceGrid Component - Integrated with Backend API
 * Manages CRUD operations for clinic services
 * Follows the same pattern as Auth integration
 */

import React, { useState, useEffect } from 'react'
import { PlusIcon, ArrowPathIcon, ExclamationCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid'
import { ServiceCard, type ClinicService } from './ServiceCard'
import { ServiceModal } from './ServiceModal'
import { PricingModal, type PricingData } from './PricingModal'
import { InheritServiceModal } from './InheritServiceModal'
import { ConfirmDialog } from '../ConfirmDialog'
import {
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
  updateHomeVisitStatus,
  updateBulkPricePerKm,
  inheritFromMasterService,
  getServicesByClinicId,
} from '../../services/endpoints/service'
import { getMyClinics, updateClinicPricePerKm } from '../../services/endpoints/clinic'
import type { ClinicResponse } from '../../services/endpoints/clinic'
import { useToast } from '../../components/Toast'
import type { ClinicServiceResponse, ClinicServiceRequest } from '../../types/service'

// Convert ClinicServiceResponse to local ClinicService type
function mapResponseToService(response: ClinicServiceResponse): ClinicService {
  return {
    id: response.serviceId,
    name: response.name,
    price: response.basePrice,
    slotsRequired: response.slotsRequired,
    duration: response.durationTime,
    isActive: response.isActive,
    isHomeVisit: response.isHomeVisit,
    pricePerKm: response.pricePerKm,
    serviceCategory: response.serviceCategory,
    petType: response.petType,
    weightPrices: response.weightPrices,
  }
}

function mapServiceToRequest(service: any): ClinicServiceRequest {
  return {
    name: service.name || '',
    basePrice: service.basePrice || 0,
    slotsRequired: service.slotsRequired || 1,
    isActive: service.isActive ?? true,
    isHomeVisit: service.isHomeVisit ?? false,
    pricePerKm: 0,
    serviceCategory: service.serviceCategory,
    petType: service.petType,
    weightPrices: service.weightPrices,
  }
}

export function ServiceGrid() {
  const [services, setServices] = useState<ClinicService[]>([])
  const [clinics, setClinics] = useState<ClinicResponse[]>([])
  const [selectedClinic, setSelectedClinic] = useState<ClinicResponse | null>(null)
  const [isClinicDropdownOpen, setIsClinicDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<ClinicServiceResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const [isInheritModalOpen, setIsInheritModalOpen] = useState(false)
  const [pricingData, setPricingData] = useState<PricingData>({
    pricePerKm: 5000,
  })
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<{ id: string; name: string } | null>(null)
  const { showToast } = useToast()

  // Fetch clinics on mount
  useEffect(() => {
    loadClinics()
  }, [])

  // Load services when clinic changes
  useEffect(() => {
    if (selectedClinic) {
      loadServicesForClinic(selectedClinic.clinicId)
    }
  }, [selectedClinic])

  const loadClinics = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getMyClinics()
      setClinics(data)
      // Auto-select first clinic if available
      if (data.length > 0) {
        setSelectedClinic(data[0])
      }
    } catch (err) {
      console.error('Failed to load clinics:', err)
      setError(
        err instanceof Error ? err.message : 'Không thể tải danh sách phòng khám',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const loadServicesForClinic = async (clinicId: string) => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getServicesByClinicId(clinicId)
      const mappedServices = data.map(mapResponseToService)
      setServices(mappedServices)
    } catch (err) {
      console.error('Failed to load services:', err)
      setError(
        err instanceof Error ? err.message : 'Không thể tải danh sách dịch vụ',
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddService = () => {
    setSelectedService(null)
    setIsModalOpen(true)
  }

  const handleEditService = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    try {
      const service = await getServiceById(id)
      setSelectedService(service)
      setIsModalOpen(true)
    } catch (err) {
      showToast('error', 'Không thể tải thông tin dịch vụ')
    }
  }

  const handleDeleteService = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    setServiceToDelete({ id, name })
    setIsDeleteDialogOpen(true)
  }

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return

    try {
      await deleteService(serviceToDelete.id, selectedClinic?.clinicId)
      setServices((prev) => prev.filter((s) => s.id !== serviceToDelete.id))
      showToast('success', 'Đã xóa dịch vụ thành công')
    } catch (err) {
      console.error('Failed to delete service:', err)
      showToast('error', 'Không thể xóa dịch vụ. Vui lòng thử lại.')
    } finally {
      setServiceToDelete(null)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleToggleStatus = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()

    try {
      const currentService = await getServiceById(id)
      const updated = await toggleServiceStatus(currentService)

      setServices((prev) =>
        prev.map((s) => (s.id === id ? mapResponseToService(updated) : s)),
      )
      showToast('success', 'Đã cập nhật trạng thái dịch vụ')
    } catch (err) {
      console.error('Failed to toggle service status:', err)
      showToast('error', 'Không thể thay đổi trạng thái dịch vụ. Vui lòng thử lại.')
    }
  }

  const handleToggleHomeVisit = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()

    try {
      const currentService = await getServiceById(id)
      const updated = await updateHomeVisitStatus(id, !currentService.isHomeVisit)

      setServices((prev) => prev.map((s) => (s.id === id ? mapResponseToService(updated) : s)))
      showToast('success', 'Đã cập nhật trạng thái tận nhà cho dịch vụ')
    } catch (err) {
      console.error('Failed to toggle home visit:', err)
      showToast('error', 'Không thể cập nhật trạng thái dịch vụ. Vui lòng thử lại.')
    }
  }

  const handleSaveService = async (
    serviceData: any
  ) => {
    try {
      setIsSubmitting(true)
      const requestData = mapServiceToRequest(serviceData)

      if (selectedService) {
        // Update existing service - preserve pricePerKm
        const updatePayload = {
          ...requestData,
          pricePerKm: selectedService.pricePerKm, // Keep existing pricePerKm
        }
        const updated = await updateService(selectedService.serviceId, updatePayload)
        setServices((prev) =>
          prev.map((s) =>
            s.id === selectedService.serviceId ? mapResponseToService(updated) : s,
          ),
        )
        showToast('success', 'Đã cập nhật dịch vụ thành công')
      } else {
        // Create new service
        const created = await createService(requestData)
        setServices((prev) => [...prev, mapResponseToService(created)])
        showToast('success', 'Đã thêm dịch vụ mới thành công')
      }

      setIsModalOpen(false)
      setSelectedService(null)
    } catch (err: any) {
      console.error('Failed to save service:', err)
      const serverMessage = err.response?.data?.message || (selectedService
        ? 'Không thể cập nhật dịch vụ. Vui lòng thử lại.'
        : 'Không thể tạo dịch vụ. Vui lòng thử lại.')
      showToast('error', serverMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSavePricing = async (data: PricingData) => {
    try {
      setIsSubmitting(true)
      await updateBulkPricePerKm(data.pricePerKm)
      // Persist clinic-level default price-per-km when a clinic is selected
      if (selectedClinic) {
        try {
          await updateClinicPricePerKm(selectedClinic.clinicId, data.pricePerKm)
        } catch (err) {
          // non-fatal: show a warning but continue
          console.warn('Failed to persist clinic price-per-km:', err)
          showToast('error', 'Không thể lưu đơn giá KM vào cơ sở dữ liệu')
        }
      }
      setPricingData(data)
      setIsPricingModalOpen(false)
      showToast('success', 'Đã cập nhật đơn giá di chuyển (KM)')
      // Reload services to show updated prices on cards
      if (selectedClinic) {
        await loadServicesForClinic(selectedClinic.clinicId)
      }
    } catch (error) {
      console.error('Failed to update pricing:', error)
      showToast('error', 'Không thể cập nhật đơn giá di chuyển')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInheritService = async (masterServiceId: string, clinicPrice?: number) => {
    if (!selectedClinic) {
      showToast('error', 'Vui lòng chọn phòng khám')
      return
    }

    try {
      setIsSubmitting(true)
      await inheritFromMasterService(masterServiceId, selectedClinic.clinicId, clinicPrice)
      setIsInheritModalOpen(false)
      showToast('success', 'Đã thừa hưởng dịch vụ thành công')
      // Reload services
      await loadServicesForClinic(selectedClinic.clinicId)
    } catch (error: any) {
      console.error('Failed to inherit service:', error)
      const serverMessage = error.response?.data?.message || 'Không thể thừa hưởng dịch vụ. Vui lòng thử lại.'
      showToast('error', serverMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <ArrowPathIcon className="w-12 h-12 animate-spin text-black" />
          <p className="text-xl font-black uppercase text-gray-600">
            Đang tải dịch vụ...
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="w-full min-h-screen bg-gray-50 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-100 border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex items-start gap-4">
              <ExclamationCircleIcon className="w-8 h-8 text-red-600 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-black uppercase mb-2">
                  Lỗi tải dữ liệu
                </h2>
                <p className="text-lg font-bold text-gray-700 mb-4">{error}</p>
                <button
                  onClick={loadClinics}
                  className="bg-black text-white px-6 py-3 border-4 border-black font-black uppercase hover:bg-gray-800 transition-colors"
                >
                  Thử lại
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-gray-50 p-6">
      <div className="w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-black uppercase tracking-tighter mb-2">
              Quản lý dịch vụ phòng khám
            </h1>
            <p className="text-gray-600 font-medium text-lg">
              Quản lý dịch vụ riêng cho từng phòng khám
            </p>
          </div>

          <div className="flex flex-wrap gap-4">


            <button
              onClick={handleAddService}
              disabled={!selectedClinic || isSubmitting}
              style={{ backgroundColor: '#FF6B35' }}
              className="group flex items-center gap-2 text-black px-6 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusIcon className="w-6 h-6" />
              <span className="font-black text-lg uppercase tracking-wide">
                Tạo dịch vụ riêng
              </span>
            </button>

            <button
              onClick={() => setIsPricingModalOpen(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-white text-black px-6 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-black text-white border-2 border-black font-black text-xl leading-none">
                $
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="font-black text-xs uppercase">Chỉnh sửa giá</span>
                <span className="font-black text-xs uppercase">Kilômét (KM)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Clinic Selector */}
        {clinics.length > 0 && (
          <div className="mb-8">
            <label className="block text-base font-black uppercase text-black mb-3">
              Chọn phòng khám
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsClinicDropdownOpen(!isClinicDropdownOpen)}
                className="w-full max-w-md p-4 border-4 border-black bg-white flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                <span className="font-bold text-black">
                  {selectedClinic ? selectedClinic.name : '-- Chọn phòng khám --'}
                </span>
                <ChevronDownIcon
                  className={`w-6 h-6 transition-transform duration-200 ${isClinicDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isClinicDropdownOpen && (
                <div className="absolute z-20 top-full left-0 right-0 max-w-md mt-2 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                  {clinics.map((clinic) => (
                    <button
                      key={clinic.clinicId}
                      type="button"
                      onClick={() => {
                        setSelectedClinic(clinic)
                        setIsClinicDropdownOpen(false)
                      }}
                      className={`w-full p-4 text-left hover:bg-gray-100 transition-colors border-b-2 border-black last:border-b-0 ${selectedClinic?.clinicId === clinic.clinicId ? 'bg-orange-50' : ''}`}
                    >
                      <span className={`font-black uppercase text-sm ${selectedClinic?.clinicId === clinic.clinicId ? 'text-[#FF6B35]' : 'text-black'}`}>
                        {clinic.name}
                      </span>
                      <p className="text-xs font-bold text-gray-600 mt-1">{clinic.address}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {services.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-block bg-white border-4 border-black p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-3xl font-black uppercase mb-4">
                Chưa có dịch vụ nào
              </h3>
              <p className="text-gray-600 font-bold mb-6">
                Hãy thêm dịch vụ đầu tiên cho phòng khám của bạn
              </p>
              <button
                onClick={handleAddService}
                style={{ backgroundColor: '#FF6B35' }}
                className="px-8 py-4 border-4 border-black font-black uppercase hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Thêm dịch vụ ngay
              </button>
            </div>
          </div>
        )}

        {/* Grid Section */}
        {services.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={async () => {
                  const fullService = await getServiceById(service.id)
                  setSelectedService(fullService)
                  setIsModalOpen(true)
                }}
                onEdit={(e) => handleEditService(e, service.id)}
                onDelete={(e) => handleDeleteService(e, service.id, service.name)}
                onToggleStatus={(e) => handleToggleStatus(e, service.id)}
                onToggleHomeVisit={(e) => handleToggleHomeVisit(e, service.id)}
              />
            ))}

            {/* Add New Placeholder Card */}
            <button
              onClick={handleAddService}
              disabled={isSubmitting}
              style={{
                backgroundColor: '#ffffff',
                borderStyle: 'dashed',
                borderWidth: '4px',
                borderColor: '#000000',
              }}
              className="group min-h-[200px] flex flex-col items-center justify-center gap-4 transition-all hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div
                style={{ backgroundColor: '#ffffff' }}
                className="p-4 rounded-full border-2 border-black transition-colors"
              >
                <PlusIcon className="w-8 h-8 text-black" />
              </div>
              <span
                style={{ color: '#6b7280' }}
                className="font-black text-xl uppercase"
              >
                Thêm dịch vụ mới
              </span>
            </button>
          </div>
        )}
      </div>

      <ServiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedService(null)
        }}
        onSave={handleSaveService}
        initialData={selectedService}
        isSubmitting={isSubmitting}
      />

      {/* Inherit Service Modal */}
      <InheritServiceModal
        isOpen={isInheritModalOpen}
        onClose={() => setIsInheritModalOpen(false)}
        onInherit={handleInheritService}
        isSubmitting={isSubmitting}
      />

      {/* Pricing Modal */}
      {isPricingModalOpen && (
        <PricingModal
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
          onSave={handleSavePricing}
          initialData={pricingData}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setServiceToDelete(null)
        }}
        onConfirm={confirmDeleteService}
        title="Xác nhận xóa dịch vụ"
        message={`Bạn có chắc chắn muốn xóa dịch vụ "${serviceToDelete?.name}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa dịch vụ"
        cancelText="Hủy bỏ"
        variant="danger"
      />
    </div>
  )
}
