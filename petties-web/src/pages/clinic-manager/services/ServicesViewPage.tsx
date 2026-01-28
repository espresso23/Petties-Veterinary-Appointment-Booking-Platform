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
// Removed brutalist.css as we are moving to standard Amber-Stone theme

/**
 * Services View Page - Read-only view for Clinic Manager
 * Shows all services of the clinic with pricing details
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
                    <h1 className="text-[27px] font-black uppercase tracking-tight text-stone-900 leading-none">
                        Dịch vụ phòng khám
                    </h1>
                    <p className="text-sm text-stone-500 mt-2">
                        Quản lý danh sách dịch vụ và bảng giá công khai của phòng khám
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="mb-8">
                <div className="relative max-w-md">
                    <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm dịch vụ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-stone-200 rounded-2xl font-bold focus:outline-none focus:border-amber-500 focus:shadow-[4px_4px_0_rgba(245,158,11,0.1)] transition-all"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="mb-8 flex flex-wrap gap-4">
                <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm flex flex-col justify-between">
                    <span className="font-bold text-stone-400 uppercase text-[10px] tracking-wider mb-2">Tổng dịch vụ</span>
                    <span className="block text-[21px] font-black text-stone-900">{services.length}</span>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm flex flex-col justify-between">
                    <span className="font-bold text-amber-500 uppercase text-[10px] tracking-wider mb-2">Đang hoạt động</span>
                    <span className="block text-[21px] font-black text-stone-900">{services.filter(s => s.isActive).length}</span>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm flex flex-col justify-between">
                    <span className="font-bold text-stone-400 uppercase text-[10px] tracking-wider mb-2">Khám tại nhà</span>
                    <span className="block text-[21px] font-black text-stone-900">{services.filter(s => s.isHomeVisit).length}</span>
                </div>
            </div>

            {/* Services Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-4 border-stone-900 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="text-center py-20 bg-white border-2 border-dashed border-stone-200 rounded-3xl">
                    <p className="text-stone-400 font-bold">Không tìm thấy dịch vụ nào</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredServices.map(service => {
                        const categoryInfo = getCategoryById(service.serviceCategory)
                        return (
                            <div
                                key={service.serviceId}
                                onClick={() => setSelectedService(service)}
                                className={`group relative bg-white border-2 border-stone-200 rounded-3xl p-6 cursor-pointer transition-all hover:border-amber-400 hover:shadow-[8px_8px_0_rgba(245,158,11,0.05)] shadow-[4px_4px_0_rgba(0,0,0,0.02)] ${!service.isActive ? 'opacity-60 grayscale' : ''}`}
                            >
                                {/* Header Row with Badges */}
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex flex-wrap gap-2">
                                        {/* Pet Type Badge */}
                                        {service.petType && (
                                            <span className="bg-blue-100 text-blue-700 rounded-xl px-2.5 py-1 text-[10px] font-black uppercase">
                                                {service.petType === 'DOG' ? 'Chó' : service.petType === 'CAT' ? 'Mèo' : service.petType === 'ALL' ? 'Tất cả' : service.petType}
                                            </span>
                                        )}
                                    </div>
                                    {/* Home Visit Badge */}
                                    {service.isHomeVisit && (
                                        <div className="bg-amber-100 text-amber-600 rounded-xl px-2.5 py-1 flex items-center gap-1 shrink-0">
                                            <HomeIcon className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-black uppercase">Tại nhà</span>
                                        </div>
                                    )}
                                </div>

                                {/* Service Name */}
                                <h3 className="text-[21px] font-black text-stone-900 uppercase tracking-tight">{service.name}</h3>

                                {/* Description */}
                                {service.description && (
                                    <p className="text-sm text-stone-500 mt-2 line-clamp-2 leading-relaxed">{service.description}</p>
                                )}

                                {/* Price */}
                                <div className="mt-4 flex items-baseline gap-2">
                                    <span className="text-[21px] font-black text-amber-600">{getPriceDisplay(service)}</span>
                                </div>

                                {/* Duration & Category */}
                                <div className="mt-4 flex items-center justify-between text-sm text-stone-600">
                                    <div className="flex items-center gap-1.5">
                                        <ClockIcon className="w-5 h-5 text-stone-400" />
                                        <span className="font-bold">{service.durationTime || 30} phút</span>
                                    </div>
                                    {categoryInfo && (
                                        <div
                                            className="px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                                            style={{ backgroundColor: categoryInfo.color, color: categoryInfo.textColor }}
                                        >
                                            <categoryInfo.icon className="w-4 h-4" />
                                            <span className="text-[10px] font-black uppercase">{categoryInfo.label}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Weight Prices Indicator */}
                                {service.weightPrices && service.weightPrices.length > 0 && (
                                    <div className="mt-4 text-[11px] bg-amber-50 text-amber-700 rounded-xl px-3 py-2 flex items-center gap-2 border border-amber-100">
                                        <ScaleIcon className="w-4 h-4" />
                                        <span className="font-bold">{service.weightPrices.length} mức phụ phí theo cân nặng</span>
                                    </div>
                                )}

                                {/* Inactive Badge */}
                                {!service.isActive && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-stone-100/80">
                                        <span className="bg-stone-900 text-white px-4 py-2 font-black uppercase transform -rotate-12">
                                            Đang ẩn
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Service Detail Modal */}
            {selectedService && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedService(null)}
                >
                    <div
                        className="bg-white rounded-[2rem] border-2 border-stone-900 shadow-[8px_8px_0_#1c1917] max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b-2 border-stone-100 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-stone-900">Chi tiết dịch vụ</h2>
                                <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mt-0.5">Clinic Service Info</p>
                            </div>
                            <button
                                onClick={() => setSelectedService(null)}
                                className="w-10 h-10 hover:bg-stone-100 rounded-full flex items-center justify-center transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 overflow-y-auto">
                            {/* Service Name */}
                            <div>
                                <p className="text-xs font-bold text-stone-500 uppercase">Tên dịch vụ</p>
                                <p className="text-lg font-black">{selectedService.name}</p>
                            </div>

                            {/* Description */}
                            {selectedService.description && (
                                <div>
                                    <p className="text-xs font-bold text-stone-500 uppercase">Mô tả</p>
                                    <p className="text-sm text-stone-700">{selectedService.description}</p>
                                </div>
                            )}

                            {/* Base Price */}
                            <div className="bg-amber-50 rounded-2xl border-2 border-amber-100 p-5">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-amber-800 uppercase text-xs tracking-wider">Giá cơ bản</span>
                                    <span className="text-3xl font-black text-amber-600">
                                        {new Intl.NumberFormat('vi-VN').format(selectedService.basePrice || 0)}đ
                                    </span>
                                </div>
                            </div>

                            {/* Duration & Slots */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-stone-50 rounded-2xl border-2 border-stone-100 p-4">
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                        <ClockIcon className="w-3.5 h-3.5" /> Thời gian
                                    </p>
                                    <p className="text-xl font-black text-stone-900">{selectedService.durationTime || 30} phút</p>
                                </div>
                                <div className="bg-stone-50 rounded-2xl border-2 border-stone-100 p-4">
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">Số slot</p>
                                    <p className="text-xl font-black text-stone-900">{selectedService.slotsRequired || 1} slot</p>
                                </div>
                            </div>

                            {/* Price Per KM */}
                            {selectedService.isHomeVisit && selectedService.pricePerKm && selectedService.pricePerKm > 0 && (
                                <div className="bg-stone-900 rounded-2xl p-5 text-white">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-stone-400 uppercase text-xs tracking-wider flex items-center gap-1">
                                            <HomeIcon className="w-4 h-4" /> Phí di chuyển
                                        </span>
                                        <span className="text-xl font-black text-amber-400">
                                            +{new Intl.NumberFormat('vi-VN').format(selectedService.pricePerKm)}đ/km
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Weight Prices */}
                            {selectedService.weightPrices && selectedService.weightPrices.length > 0 && (
                                <div className="pt-2">
                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                        <ScaleIcon className="w-4 h-4" /> Phụ phí theo cân nặng
                                    </p>
                                    <div className="space-y-3">
                                        {selectedService.weightPrices.map((wp: WeightPriceDto, idx: number) => (
                                            <div key={idx} className="rounded-2xl border-2 border-stone-100 p-4 bg-white hover:border-amber-200 transition-colors">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-black text-stone-900">
                                                        {wp.minWeight} - {wp.maxWeight} kg
                                                    </span>
                                                    <span className="font-black text-amber-600 text-lg">
                                                        +{new Intl.NumberFormat('vi-VN').format(wp.price || 0)}đ
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-bold text-stone-400 mt-1 uppercase tracking-widest">
                                                    Tổng cộng: {new Intl.NumberFormat('vi-VN').format((selectedService.basePrice || 0) + (wp.price || 0))}đ
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
