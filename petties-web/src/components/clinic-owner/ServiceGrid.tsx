/**
 * ServiceGrid Component - Integrated with Backend API
 * Manages CRUD operations for clinic services
 * Follows the same pattern as Auth integration
 */

import React, { useState, useEffect } from 'react'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import { ServiceCard, type Service } from './ServiceCard'
import { ServiceModal } from './ServiceModal'
import {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  toggleServiceStatus,
} from '../../services/endpoints/service'
import type { ServiceResponse, ServiceRequest } from '../../types/service'

// Convert ServiceResponse to local Service type for backward compatibility
function mapResponseToService(response: ServiceResponse): Service {
  return {
    id: response.serviceId,
    name: response.name,
    price: Number(response.basePrice),
    duration: response.durationTime,
    isActive: response.isActive,
    isHomeVisit: response.isHomeVisit,
    serviceCategory: response.serviceCategory,
    petType: response.petType,
    weightPrices: response.weightPrices,
  }
}

function mapServiceToRequest(service: Partial<Service>): ServiceRequest {
  // Calculate slots based on duration: 30 minutes = 1 slot
  const duration = service.duration || 30
  const calculatedSlots = Math.ceil(duration / 30)
  
  return {
    name: service.name || '',
    basePrice: service.price?.toString() || '0',
    durationTime: duration,
    slotsRequired: calculatedSlots,
    isActive: service.isActive ?? true,
    isHomeVisit: service.isHomeVisit ?? false,
    pricePerKm: service.isHomeVisit ? '0' : undefined,
    serviceCategory: service.serviceCategory,
    petType: service.petType,
    weightPrices: service.weightPrices,
  }
}

export function ServiceGrid() {
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch services on mount
  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await getAllServices()
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

  const handleEditService = (e: React.MouseEvent, service: Service) => {
    e.stopPropagation()
    setSelectedService(service)
    setIsModalOpen(true)
  }

  const handleDeleteService = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Bạn có chắc chắn muốn xóa dịch vụ này?')) {
      return
    }

    try {
      await deleteService(id)
      // Remove from local state immediately
      setServices((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Failed to delete service:', err)
      alert('Không thể xóa dịch vụ. Vui lòng thử lại.')
    }
  }

  const handleToggleStatus = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()

    try {
      // Get current service data from API
      const currentService = await getServiceById(id)
      
      // Toggle status via PATCH endpoint
      const updated = await toggleServiceStatus(currentService)
      
      // Update local state
      setServices((prev) =>
        prev.map((s) => (s.id === id ? mapResponseToService(updated) : s)),
      )
    } catch (err) {
      console.error('Failed to toggle service status:', err)
      alert('Không thể thay đổi trạng thái dịch vụ. Vui lòng thử lại.')
    }
  }

  const handleSaveService = async (
    serviceData: Omit<Service, 'id' | 'isActive'>,
  ) => {
    try {
      setIsSubmitting(true)
      const requestData = mapServiceToRequest(serviceData)

      if (selectedService) {
        // Update existing service
        const updated = await updateService(selectedService.id, requestData)
        setServices((prev) =>
          prev.map((s) =>
            s.id === selectedService.id ? mapResponseToService(updated) : s,
          ),
        )
      } else {
        // Create new service
        const created = await createService(requestData)
        setServices((prev) => [...prev, mapResponseToService(created)])
      }

      setIsModalOpen(false)
      setSelectedService(null)
    } catch (err) {
      console.error('Failed to save service:', err)
      alert(
        selectedService
          ? 'Không thể cập nhật dịch vụ. Vui lòng thử lại.'
          : 'Không thể tạo dịch vụ. Vui lòng thử lại.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-black" />
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
              <AlertCircle className="w-8 h-8 text-red-600 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-black uppercase mb-2">
                  Lỗi tải dữ liệu
                </h2>
                <p className="text-lg font-bold text-gray-700 mb-4">{error}</p>
                <button
                  onClick={loadServices}
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
              Quản lý dịch vụ
            </h1>
            <p className="text-gray-600 font-medium text-lg">
              Quản lý danh sách dịch vụ, giá cả và thời gian thực hiện
            </p>
          </div>

          <button
            onClick={handleAddService}
            disabled={isSubmitting}
            style={{ backgroundColor: '#FF6B35' }}
            className="group flex items-center gap-2 text-black px-6 py-4 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={24} strokeWidth={3} />
            <span className="font-black text-lg uppercase tracking-wide">
              Thêm dịch vụ
            </span>
          </button>
        </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-12">{services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={() => {
                  setSelectedService(service)
                  setIsModalOpen(true)
                }}
                onEdit={(e) => handleEditService(e, service)}
                onDelete={(e) => handleDeleteService(e, service.id)}
                onToggleStatus={(e) => handleToggleStatus(e, service.id)}
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
                <Plus size={32} className="text-black" />
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
    </div>
  )
}
