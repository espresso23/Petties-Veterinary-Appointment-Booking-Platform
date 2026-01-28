/**
 * MasterServiceGrid Component - Quản lý Dịch vụ mẫu
 * Template services cho tất cả phòng khám
 */

import React, { useState, useEffect } from 'react'
import { PlusIcon, ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/solid'
import { MasterServiceCard, type MasterService } from './MasterServiceCard'
import { MasterServiceModal } from './MasterServiceModal'
import { ConfirmDialog } from '../common/ConfirmDialog'
import {
  getAllMasterServices,
  getMasterServiceById,
  createMasterService,
  updateMasterService,
  deleteMasterService,
} from '../../services/endpoints/masterService'
import { inheritFromMasterService } from '../../services/endpoints/service'
import { getServicesByClinicId } from '../../services/endpoints/service'
import { useToast } from '../Toast'
import { ClinicSelectModal } from './ClinicSelectModal'
import type { ClinicApplyItem } from './ClinicSelectModal'
import { getClinicPricePerKm } from '../../services/endpoints/clinic'
import type { MasterServiceResponse, MasterServiceRequest } from '../../types/service'

// Convert MasterServiceResponse to local MasterService type
function mapResponseToMasterService(response: MasterServiceResponse): MasterService {
  return {
    id: response.masterServiceId,
    name: response.name,
    defaultPrice: response.defaultPrice,
    slotsRequired: response.slotsRequired,
    durationTime: response.durationTime,
    isHomeVisit: response.isHomeVisit,
    defaultPricePerKm: response.defaultPricePerKm,
    serviceCategory: response.serviceCategory,
    petType: response.petType,
    description: response.description,
    icon: response.icon,
    weightPrices: response.weightPrices,
  }
}

export function MasterServiceGrid() {
  const [services, setServices] = useState<MasterService[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<MasterServiceResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<{ id: string; name: string } | null>(null)
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set())
  const [isApplyMode, setIsApplyMode] = useState(false)
  const { showToast } = useToast()
  const [isClinicModalOpen, setIsClinicModalOpen] = useState(false)

  // Fetch master services on mount
  useEffect(() => {
    loadMasterServices()
  }, [])

  const loadMasterServices = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getAllMasterServices()
      const mappedServices = data.map(mapResponseToMasterService)
      setServices(mappedServices)
    } catch (err) {
      console.error('Failed to load master services:', err)
      setError(
        err instanceof Error ? err.message : 'Không thể tải danh sách dịch vụ mẫu',
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
      const service = await getMasterServiceById(id)
      setSelectedService(service)
      setIsModalOpen(true)
    } catch (err) {
      showToast('error', 'Không thể tải thông tin dịch vụ mẫu')
    }
  }

  const handleDeleteService = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    setServiceToDelete({ id, name })
    setIsDeleteDialogOpen(true)
  }

  const handleToggleHomeVisit = async (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation()
    try {
      const service = services.find(s => s.id === serviceId)
      if (!service) return

      await updateMasterService(serviceId, { isHomeVisit: !service.isHomeVisit })
      setServices(prev => prev.map(s =>
        s.id === serviceId ? { ...s, isHomeVisit: !s.isHomeVisit } : s
      ))
      showToast('success', `Đã ${!service.isHomeVisit ? 'chuyển thành' : 'hủy'} dịch vụ tại nhà`)
    } catch (err) {
      console.error('Failed to toggle home visit:', err)
      showToast('error', 'Không thể cập nhật trạng thái dịch vụ. Vui lòng thử lại.')
    }
  }

  const confirmDeleteService = async () => {
    if (!serviceToDelete) return

    try {
      await deleteMasterService(serviceToDelete.id)
      setServices((prev) => prev.filter((s) => s.id !== serviceToDelete.id))
      showToast('success', 'Đã xóa dịch vụ mẫu thành công')
    } catch (err) {
      console.error('Failed to delete master service:', err)
      showToast('error', 'Không thể xóa dịch vụ mẫu. Vui lòng thử lại.')
    } finally {
      setServiceToDelete(null)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleSaveService = async (serviceData: any) => {
    try {
      setIsSubmitting(true)
      const requestData: MasterServiceRequest = {
        name: serviceData.name,
        description: serviceData.description,
        defaultPrice: serviceData.defaultPrice,
        slotsRequired: serviceData.slotsRequired,
        durationTime: serviceData.durationTime || serviceData.slotsRequired * 30,
        isHomeVisit: serviceData.isHomeVisit,
        serviceCategory: serviceData.serviceCategory,
        petType: serviceData.petType,
        icon: serviceData.icon,
        weightPrices: serviceData.weightPrices,
      }

      if (selectedService) {
        // Update existing master service
        const updated = await updateMasterService(selectedService.masterServiceId, requestData)
        setServices((prev) =>
          prev.map((s) =>
            s.id === selectedService.masterServiceId ? mapResponseToMasterService(updated) : s,
          ),
        )
        showToast('success', 'Đã cập nhật dịch vụ mẫu thành công')
      } else {
        // Create new master service
        const created = await createMasterService(requestData)
        setServices((prev) => [...prev, mapResponseToMasterService(created)])
        showToast('success', 'Đã thêm dịch vụ mẫu mới thành công')
      }

      setIsModalOpen(false)
      setSelectedService(null)
    } catch (err: any) {
      console.error('Failed to save master service:', err)
      const serverMessage = err.response?.data?.message || (selectedService
        ? 'Không thể cập nhật dịch vụ mẫu. Vui lòng thử lại.'
        : 'Không thể tạo dịch vụ mẫu. Vui lòng thử lại.')
      showToast('error', serverMessage)
    } finally {
      setIsSubmitting(false)
    }
  }
  // Giả lập kiểm tra có phòng khám hay chưa (thực tế lấy từ store hoặc API)
  const [hasClinic, setHasClinic] = useState(true)
  useEffect(() => {
    // TODO: Thay bằng kiểm tra thực tế từ store hoặc API
    // setHasClinic(!!clinicStore.clinic)
    setHasClinic(true)
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <ArrowPathIcon className="w-12 h-12 animate-spin text-black" />
          <p className="text-xl font-black uppercase text-gray-600">
            Đang tải dịch vụ mẫu...
          </p>
        </div>
      </div>
    )
  }

  // Nếu chưa có phòng khám thì hiển thị thông báo và nút tạo phòng khám
  if (!hasClinic) {
    return (
      <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="text-2xl font-black text-black mb-4">Bạn chưa có phòng khám nào</div>
          <div className="text-base font-bold text-gray-600 mb-6">Hãy tạo phòng khám để bắt đầu tạo dịch vụ mẫu cho phòng khám của bạn.</div>
          <a
            href="/clinic-owner/clinic-create"
            className="px-8 py-4 bg-[#FF6B35] text-white font-black border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-orange-500 transition-all text-lg uppercase"
          >
            Tạo phòng khám
          </a>
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
                  onClick={loadMasterServices}
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
              Quản lý dịch vụ mẫu
            </h1>
            <p className="text-gray-600 font-medium text-lg">
              Template dịch vụ cho tất cả phòng khám - Mọi phòng khám đều có thể áp dụng
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isApplyMode ? (
              <>
                <button
                  onClick={() => setIsApplyMode(true)}
                  style={{ backgroundColor: '#16a34a' }}
                  className="group flex items-center gap-2 text-white px-6 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
                >
                  <span className="font-black text-lg uppercase tracking-wide" style={{ color: '#ffffff' }}>Chọn & Áp dụng</span>
                </button>
                <button
                  onClick={handleAddService}
                  disabled={isSubmitting}
                  style={{ backgroundColor: '#FF6B35' }}
                  className="group flex items-center gap-2 text-white px-6 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PlusIcon className="w-6 h-6" />
                  <span className="font-black text-lg uppercase tracking-wide">Thêm dịch vụ mẫu</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsApplyMode(false)
                    setSelectedServiceIds(new Set())
                  }}
                  style={{ backgroundColor: '#4b5563' }}
                  className="group flex items-center gap-2 text-white px-6 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
                >
                  <span className="font-black text-lg uppercase tracking-wide" style={{ color: '#ffffff' }}>Hủy</span>
                </button>
                {selectedServiceIds.size > 0 && (
                  <button
                    onClick={() => setIsClinicModalOpen(true)}
                    style={{ backgroundColor: '#16a34a' }}
                    className="group flex items-center gap-2 text-white px-6 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all"
                  >
                    <span className="font-black text-lg uppercase tracking-wide" style={{ color: '#ffffff' }}>
                      Áp dụng ({selectedServiceIds.size})
                    </span>
                  </button>
                )}
                <ClinicSelectModal
                  isOpen={isClinicModalOpen}
                  onClose={() => setIsClinicModalOpen(false)}
                  onApply={async (selectedClinics: ClinicApplyItem[]) => {
                    setIsClinicModalOpen(false)

                    try {
                      // Prepare promises for applying master services
                      const promises: Promise<any>[] = []

                      // Prefetch missing per-km prices for clinics that didn't provide one using dedicated endpoint
                      const clinicsNeedingFetch = selectedClinics.filter(c => c.clinicPricePerKm === undefined || c.clinicPricePerKm === null)
                      const fetchedPriceMap: Record<string, number | undefined> = {}
                      await Promise.all(clinicsNeedingFetch.map(async (c) => {
                        try {
                          const p = await getClinicPricePerKm(c.clinicId)
                          if (p !== null && p !== undefined) {
                            fetchedPriceMap[c.clinicId] = p
                            return
                          }
                          // fallback: try to infer from existing services
                          try {
                            const existingServices = await getServicesByClinicId(c.clinicId)
                            const hv = existingServices.find(s => s.isHomeVisit && s.pricePerKm && Number(s.pricePerKm) > 0)
                            if (hv && hv.pricePerKm) fetchedPriceMap[c.clinicId] = hv.pricePerKm
                          } catch (err2) {
                            console.warn('Failed to fetch existing services for clinic', c.clinicId, err2)
                          }
                        } catch (err) {
                          console.warn('Failed to fetch price-per-km for clinic', c.clinicId, err)
                        }
                      }))

                      for (const masterServiceId of selectedServiceIds) {
                        for (const clinic of selectedClinics) {
                          // Use clinic provided override first, then fetched stored value, otherwise undefined
                          const clinicPricePerKm = clinic.clinicPricePerKm ?? fetchedPriceMap[clinic.clinicId] ?? undefined
                          promises.push(inheritFromMasterService(masterServiceId, clinic.clinicId, undefined, clinicPricePerKm))
                        }
                      }

                      await Promise.all(promises)

                      showToast('success', `Đã áp dụng ${selectedServiceIds.size} dịch vụ mẫu cho ${selectedClinics.length} phòng khám thành công!`)

                      // Reset selection
                      setSelectedServiceIds(new Set())
                      setIsApplyMode(false)
                    } catch (error) {
                      console.error('Failed to apply master services:', error)
                      showToast('error', 'Có lỗi xảy ra khi áp dụng dịch vụ mẫu. Vui lòng thử lại.')
                    }
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Empty State */}
        {services.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-block bg-white border-4 border-black p-12 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="text-3xl font-black uppercase mb-4">
                Chưa có dịch vụ mẫu nào
              </h3>
              <p className="text-gray-600 font-bold mb-6">
                Hãy tạo dịch vụ mẫu đầu tiên cho hệ thống
              </p>
              <button
                onClick={handleAddService}
                style={{ backgroundColor: '#FF6B35' }}
                className="px-8 py-4 border-4 border-black font-black uppercase hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
              >
                Thêm dịch vụ mẫu ngay
              </button>
            </div>
          </div>
        )}

        {/* Grid Section */}
        {services.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">
            {services.map((service) => (
              <MasterServiceCard
                key={service.id}
                service={service}
                onEdit={(e) => handleEditService(e, service.id)}
                onDelete={(e) => handleDeleteService(e, service.id, service.name)}
                onToggleHomeVisit={(e) => handleToggleHomeVisit(e, service.id)}
                onClick={() => { }}
                isSelectable={isApplyMode}
                isSelected={selectedServiceIds.has(service.id)}
                onSelect={(selected) => {
                  const newSet = new Set(selectedServiceIds)
                  if (selected) {
                    newSet.add(service.id)
                  } else {
                    newSet.delete(service.id)
                  }
                  setSelectedServiceIds(newSet)
                }}
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
                Thêm dịch vụ mẫu
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Master Service Modal */}
      <MasterServiceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedService(null)
        }}
        onSave={handleSaveService}
        initialData={selectedService}
        isSubmitting={isSubmitting}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Xác nhận xóa dịch vụ mẫu"
        message={
          serviceToDelete
            ? `Bạn có chắc chắn muốn xóa dịch vụ mẫu "${serviceToDelete.name}"? Các phòng khám đã áp dụng sẽ không bị ảnh hưởng.`
            : ''
        }
        confirmText="Xóa dịch vụ mẫu"
        cancelText="Hủy"
        onConfirm={confirmDeleteService}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setServiceToDelete(null)
        }}
        variant="danger"
      />
    </div>
  )
}
