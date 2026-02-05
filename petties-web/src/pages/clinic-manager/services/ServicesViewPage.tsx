import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../../store/authStore'
import { getServicesByClinicId } from '../../../services/endpoints/service'
import type { ClinicServiceResponse, WeightPriceDto } from '../../../types/service'
import { getCategoryById } from '../../../constants/serviceCategory'
import {
    ClockIcon,
    HomeIcon,
    XMarkIcon,
    ScaleIcon,
    MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import '../../../styles/brutalist.css'

/**
 * Services View Page - Read-only view for Clinic Manager
 * Shows all services of the clinic with pricing details
 * Design: Soft Neobrutalism - 2px borders, 12px radius, offset shadows
 */
export const ServicesViewPage = () => {
    const { user } = useAuthStore()
    const [services, setServices] = useState<ClinicServiceResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedService, setSelectedService] = useState<ClinicServiceResponse | null>(null)

    // Fetch services
    const fetchServices = useCallback(async () => {
        if (!user?.workingClinicId) return

        setLoading(true)
        try {
            const response = await getServicesByClinicId(user.workingClinicId)
            setServices(response || [])
        } catch (error) {
            console.error('Failed to fetch services:', error)
        } finally {
            setLoading(false)
        }
    }, [user?.workingClinicId])

    useEffect(() => {
        fetchServices()
    }, [fetchServices])

    // Filter services by search term
    const filteredServices = services.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.serviceCategory && service.serviceCategory.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    // Calculate price range
    const getPriceDisplay = (service: ClinicServiceResponse) => {
        const basePrice = service.basePrice || 0
        const weightPrices = service.weightPrices || []

        if (weightPrices.length === 0) {
            return new Intl.NumberFormat('vi-VN').format(basePrice) + 'đ'
        }

        const surcharges = weightPrices.map(wp => wp.price || 0)
        const minSurcharge = Math.min(...surcharges)
        const maxSurcharge = Math.max(...surcharges)

        const minPrice = basePrice + minSurcharge
        const maxPrice = basePrice + maxSurcharge

        if (minPrice === maxPrice) {
            return new Intl.NumberFormat('vi-VN').format(minPrice) + 'đ'
        }

        const minFormatted = new Intl.NumberFormat('vi-VN').format(minPrice)
        const maxFormatted = new Intl.NumberFormat('vi-VN').format(maxPrice)
        return `${minFormatted} - ${maxFormatted}đ`
    }

    return (
        <div className="min-h-screen bg-stone-50 p-6 font-sans">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-stone-900">
                        Dịch vụ phòng khám
                    </h1>
                    <p className="text-sm text-stone-500 mt-1 font-medium">
                        Phòng khám: <span className="text-amber-600 font-bold">{user?.workingClinicName || 'N/A'}</span>
                    </p>
                </div>
            </div>

            {/* Search - Neobrutalism style */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm dịch vụ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-stone-900 rounded-lg font-medium shadow-[2px_2px_0_#1c1917] focus:outline-none focus:shadow-[3px_3px_0_#1c1917] focus:border-amber-600 focus:-translate-x-0.5 focus:-translate-y-0.5 transition-all"
                    />
                </div>
            </div>

            {/* Stats - Neobrutalism cards */}
            <div className="mb-6 grid grid-cols-3 gap-4 max-w-xl">
                <div className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
                    <span className="text-xs font-bold text-stone-500 uppercase">Tổng dịch vụ</span>
                    <span className="block text-2xl font-bold text-stone-900 mt-1">{services.length}</span>
                </div>
                <div className="bg-amber-50 border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
                    <span className="text-xs font-bold text-amber-700 uppercase">Hoạt động</span>
                    <span className="block text-2xl font-bold text-amber-600 mt-1">{services.filter(s => s.isActive).length}</span>
                </div>
                <div className="bg-blue-50 border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
                    <span className="text-xs font-bold text-blue-700 uppercase">Tại nhà</span>
                    <span className="block text-2xl font-bold text-blue-600 mt-1">{services.filter(s => s.isHomeVisit).length}</span>
                </div>
            </div>

            {/* Services Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-stone-900 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="text-center py-16 bg-white border-2 border-dashed border-stone-300 rounded-xl">
                    <p className="text-stone-500 font-bold">Không tìm thấy dịch vụ nào</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredServices.map(service => {
                        const categoryInfo = getCategoryById(service.serviceCategory)
                        return (
                            <div
                                key={service.serviceId}
                                onClick={() => setSelectedService(service)}
                                className={`group relative bg-white border-2 border-stone-900 rounded-xl p-5 cursor-pointer shadow-[4px_4px_0_#1c1917] hover:shadow-[6px_6px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all ${!service.isActive ? 'opacity-60 grayscale' : ''}`}
                            >
                                {/* Header Row with Badges */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex flex-wrap gap-2">
                                        {/* Pet Type Badge */}
                                        {service.petType && (
                                            <span className="bg-blue-100 text-blue-800 border-2 border-stone-900 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase shadow-[2px_2px_0_#1c1917]">
                                                {service.petType === 'DOG' ? 'Chó' : service.petType === 'CAT' ? 'Mèo' : service.petType === 'ALL' ? 'Tất cả' : service.petType}
                                            </span>
                                        )}
                                    </div>
                                    {/* Home Visit Badge */}
                                    {service.isHomeVisit && (
                                        <div className="bg-amber-100 text-amber-800 border-2 border-stone-900 rounded-full px-2.5 py-0.5 flex items-center gap-1 shadow-[2px_2px_0_#1c1917]">
                                            <HomeIcon className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold uppercase">Tại nhà</span>
                                        </div>
                                    )}
                                </div>

                                {/* Service Name */}
                                <h3 className="text-lg font-bold text-stone-900">{service.name}</h3>

                                {/* Description */}
                                {service.description && (
                                    <p className="text-sm text-stone-600 mt-2 line-clamp-2">{service.description}</p>
                                )}

                                {/* Price */}
                                <div className="mt-4">
                                    <span className="text-xl font-bold text-amber-600">{getPriceDisplay(service)}</span>
                                </div>

                                {/* Duration & Category */}
                                <div className="mt-4 flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-1.5 text-stone-600">
                                        <ClockIcon className="w-4 h-4" />
                                        <span className="font-medium">{service.durationTime || 30} phút</span>
                                    </div>
                                    {categoryInfo && (
                                        <div
                                            className="px-2 py-1 rounded-lg border-2 border-stone-900 flex items-center gap-1 shadow-[2px_2px_0_#1c1917]"
                                            style={{ backgroundColor: categoryInfo.color, color: categoryInfo.textColor }}
                                        >
                                            <categoryInfo.icon className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold uppercase">{categoryInfo.label}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Weight Prices Indicator */}
                                {service.weightPrices && service.weightPrices.length > 0 && (
                                    <div className="mt-4 bg-amber-50 border-2 border-amber-600 rounded-lg px-3 py-2 flex items-center gap-2">
                                        <ScaleIcon className="w-4 h-4 text-amber-700" />
                                        <span className="text-xs font-bold text-amber-800">{service.weightPrices.length} mức phụ phí theo cân nặng</span>
                                    </div>
                                )}

                                {/* Inactive Overlay */}
                                {!service.isActive && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-stone-100/80 rounded-xl">
                                        <span className="bg-stone-900 text-white px-4 py-2 font-bold uppercase transform -rotate-12 border-2 border-stone-900 shadow-[3px_3px_0_#1c1917]">
                                            Đang ẩn
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Service Detail Modal - Neobrutalism */}
            {selectedService && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedService(null)}
                >
                    <div
                        className="bg-white rounded-xl border-2 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-5 border-b-4 border-stone-900 bg-amber-50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-stone-900">Chi tiết dịch vụ</h2>
                            </div>
                            <button
                                onClick={() => setSelectedService(null)}
                                className="w-10 h-10 bg-white border-2 border-stone-900 rounded-lg flex items-center justify-center shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto">
                            {/* Service Name */}
                            <div>
                                <p className="text-xs font-bold text-stone-500 uppercase mb-1">Tên dịch vụ</p>
                                <p className="text-lg font-bold text-stone-900">{selectedService.name}</p>
                            </div>

                            {/* Description */}
                            {selectedService.description && (
                                <div>
                                    <p className="text-xs font-bold text-stone-500 uppercase mb-1">Mô tả</p>
                                    <p className="text-sm text-stone-700">{selectedService.description}</p>
                                </div>
                            )}

                            {/* Base Price Card */}
                            <div className="bg-amber-100 border-2 border-stone-900 rounded-xl p-4 shadow-[3px_3px_0_#1c1917]">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-amber-800 uppercase text-xs">Giá cơ bản</span>
                                    <span className="text-2xl font-bold text-amber-600">
                                        {new Intl.NumberFormat('vi-VN').format(selectedService.basePrice || 0)}đ
                                    </span>
                                </div>
                            </div>

                            {/* Duration & Slots */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-stone-50 border-2 border-stone-900 rounded-xl p-4 shadow-[2px_2px_0_#1c1917]">
                                    <p className="text-xs font-bold text-stone-500 uppercase mb-1 flex items-center gap-1">
                                        <ClockIcon className="w-3.5 h-3.5" /> Thời gian
                                    </p>
                                    <p className="text-xl font-bold text-stone-900">{selectedService.durationTime || 30} phút</p>
                                </div>
                                <div className="bg-stone-50 border-2 border-stone-900 rounded-xl p-4 shadow-[2px_2px_0_#1c1917]">
                                    <p className="text-xs font-bold text-stone-500 uppercase mb-1">Số slot</p>
                                    <p className="text-xl font-bold text-stone-900">{selectedService.slotsRequired || 1} slot</p>
                                </div>
                            </div>

                            {/* Price Per KM - Removed: pricePerKm no longer exists on ClinicServiceResponse */}

                            {/* Weight Prices */}
                            {selectedService.weightPrices && selectedService.weightPrices.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold text-stone-500 uppercase mb-3 flex items-center gap-1">
                                        <ScaleIcon className="w-4 h-4" /> Phụ phí theo cân nặng
                                    </p>
                                    <div className="space-y-3">
                                        {selectedService.weightPrices.map((wp: WeightPriceDto, idx: number) => (
                                            <div key={idx} className="border-2 border-stone-900 rounded-lg p-4 bg-white shadow-[2px_2px_0_#1c1917] hover:shadow-[3px_3px_0_#1c1917] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-stone-900">
                                                        {wp.minWeight} - {wp.maxWeight} kg
                                                    </span>
                                                    <span className="font-bold text-amber-600 text-lg">
                                                        +{new Intl.NumberFormat('vi-VN').format(wp.price || 0)}đ
                                                    </span>
                                                </div>
                                                <div className="text-xs font-medium text-stone-500 mt-1">
                                                    Tổng cộng: <span className="font-bold text-stone-700">{new Intl.NumberFormat('vi-VN').format((selectedService.basePrice || 0) + (wp.price || 0))}đ</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ServicesViewPage
