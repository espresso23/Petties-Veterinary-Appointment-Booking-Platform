import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
    MapPinIcon,
    PhoneIcon,
    EnvelopeIcon,
    StarIcon,
    PencilIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { useClinicStore } from '../../../store/clinicStore'
import { useAuthStore } from '../../../store/authStore'
import { ClinicMapOSM } from '../../../components/clinic/ClinicMapOSM'
import { ClinicLogoDisplay } from '../../../components/clinic/ClinicLogoDisplay'
import { VIETQR_BANKS } from '../../../utils/vietqr'
import { useToast } from '../../../components/Toast'
import type { ClinicRequest } from '../../../types/clinic'

export function ClinicInfoPage() {
    const navigate = useNavigate()
    const { user } = useAuthStore()
    const { showToast } = useToast()
    const clinicId = user?.workingClinicId
    const { currentClinic, fetchClinicById, updateClinic, isLoading, error } = useClinicStore()
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const [canScrollLeft, setCanScrollLeft] = useState(false)
    const [canScrollRight, setCanScrollRight] = useState(false)

    // Inline edit state
    const [isEditingPayment, setIsEditingPayment] = useState(false)
    const [editPaymentData, setEditPaymentData] = useState({
        sosFee: 0,
        bankName: '',
        accountNumber: ''
    })
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (clinicId) {
            fetchClinicById(clinicId)
        }
    }, [clinicId, fetchClinicById])

    const updateScrollState = () => {
        const el = scrollRef.current
        if (!el) return
        const { scrollLeft, scrollWidth, clientWidth } = el
        const maxScrollLeft = scrollWidth - clientWidth - 1
        setCanScrollLeft(scrollLeft > 0)
        setCanScrollRight(scrollLeft < maxScrollLeft)
    }

    const handleScrollRight = () => {
        const el = scrollRef.current
        if (!el) return
        const delta = el.clientWidth * 0.8
        el.scrollBy({ left: delta, behavior: 'smooth' })
    }

    const handleScrollLeft = () => {
        const el = scrollRef.current
        if (!el) return
        const delta = el.clientWidth * 0.8
        el.scrollBy({ left: -delta, behavior: 'smooth' })
    }

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        updateScrollState()
        el.addEventListener('scroll', updateScrollState, { passive: true })
        window.addEventListener('resize', updateScrollState)
        return () => {
            el.removeEventListener('scroll', updateScrollState)
            window.removeEventListener('resize', updateScrollState)
        }
    }, [currentClinic?.images])

    const handleStartEditingPayment = () => {
        if (!currentClinic) return
        setEditPaymentData({
            sosFee: currentClinic.sosFee || 0,
            bankName: currentClinic.bankName || '',
            accountNumber: currentClinic.accountNumber || ''
        })
        setIsEditingPayment(true)
    }

    const handleCancelEditingPayment = () => {
        setIsEditingPayment(false)
    }

    const handleSavePayment = async () => {
        if (!clinicId || !currentClinic) return

        setIsSaving(true)
        try {
            const requestData: ClinicRequest = {
                name: currentClinic.name,
                description: currentClinic.description,
                address: currentClinic.address,
                ward: currentClinic.ward,
                district: currentClinic.district,
                province: currentClinic.province,
                specificLocation: currentClinic.specificLocation,
                phone: currentClinic.phone,
                email: currentClinic.email,
                operatingHours: currentClinic.operatingHours,
                latitude: currentClinic.latitude,
                longitude: currentClinic.longitude,
                logo: currentClinic.logo,
                businessLicenseUrl: currentClinic.businessLicenseUrl,
                sosFee: editPaymentData.sosFee,
                bankName: currentClinic.bankName,
                accountNumber: currentClinic.accountNumber,
            }

            await updateClinic(clinicId, requestData)
            showToast('success', 'Cập nhật thông tin thanh toán thành công!')
            setIsEditingPayment(false)
            fetchClinicById(clinicId)
        } catch (err) {
            showToast('error', 'Có lỗi xảy ra khi cập nhật thông tin.')
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-center py-12">
                        <div className="text-stone-600 font-bold uppercase">Đang tải thông tin...</div>
                    </div>
                </div>
            </div>
        )
    }

    if (error || !currentClinic || !clinicId) {
        return (
            <div className="p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="card-brutal p-12 text-center">
                        <div className="text-stone-600 font-bold uppercase text-lg mb-2">
                            {error || 'Không tìm thấy thông tin phòng khám được gán'}
                        </div>
                        <p className="text-stone-500 mb-6">Vui lòng liên hệ Admin nếu bạn chưa được gán vào phòng khám nào.</p>
                        <button
                            onClick={() => navigate('/clinic-manager')}
                            className="btn-brutal-outline"
                        >
                            QUAY LẠI DASHBOARD
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const statusColors: Record<string, string> = {
        PENDING: 'bg-amber-100 text-amber-800 border-amber-600',
        APPROVED: 'bg-green-100 text-green-800 border-green-600',
        REJECTED: 'bg-red-100 text-red-800 border-red-600',
        SUSPENDED: 'bg-gray-100 text-gray-800 border-gray-600',
    }

    const statusLabels: Record<string, string> = {
        PENDING: 'CHỜ DUYỆT',
        APPROVED: 'ĐÃ DUYỆT',
        REJECTED: 'TỪ CHỐI',
        SUSPENDED: 'TẠM NGƯNG',
    }

    const DAY_LABELS: Record<string, string> = {
        MONDAY: 'THỨ HAI',
        TUESDAY: 'THỨ BA',
        WEDNESDAY: 'THỨ TƯ',
        THURSDAY: 'THỨ NĂM',
        FRIDAY: 'THỨ SÁU',
        SATURDAY: 'THỨ BẢY',
        SUNDAY: 'CHỦ NHẬT',
    }

    const DAYS_OF_WEEK = [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
    ] as const

    return (
        <div className="min-h-screen bg-[#FFFDF8] text-black">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-6 gap-4">
                    <div className="flex-1">
                        <div className="flex items-center justify-between gap-4 mb-2">
                            <Link
                                to="/clinic-manager"
                                className="btn-brutal-outline px-3 py-2 text-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                            >
                                ← QUAY LẠI DASHBOARD
                            </Link>
                            <div className="flex gap-2">
                                <Link
                                    to="/clinic-manager/clinic/edit"
                                    className="btn-brutal"
                                >
                                    <PencilIcon className="w-4 h-4 mr-2" />
                                    CHỈNH SỬA THÔNG TIN
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mb-3">
                            <ClinicLogoDisplay logoUrl={currentClinic.logo} alt={`${currentClinic.name} Logo`} size="md" />
                            <div className="flex-1">
                                <h1 className="text-3xl md:text-4xl font-extrabold uppercase text-stone-900 leading-tight">
                                    {currentClinic.name}
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-xs font-bold uppercase text-stone-600">Trạng thái</div>
                            <div
                                className={`inline-block px-3 py-1 border-[3px] border-black font-black text-xs uppercase bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${statusColors[currentClinic.status] || statusColors.PENDING
                                    }`}
                            >
                                {statusLabels[currentClinic.status] || currentClinic.status}
                            </div>
                            {currentClinic.ratingAvg > 0 && (
                                <div className="flex items-center gap-1">
                                    <StarIcon className="w-5 h-5 text-amber-600 fill-amber-600" />
                                    <span className="font-bold text-stone-900">{currentClinic.ratingAvg.toFixed(1)}</span>
                                    <span className="text-stone-600 text-sm">({currentClinic.ratingCount})</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Clinic Images Gallery */}
                {(() => {
                    const images =
                        currentClinic.imageDetails?.length
                            ? currentClinic.imageDetails.map((img) => ({
                                url: img.imageUrl,
                                isPrimary: img.isPrimary,
                            }))
                            : currentClinic.images?.map((img, idx) =>
                                typeof img === 'string'
                                    ? { url: img, isPrimary: idx === 0 }
                                    : { url: img.imageUrl, isPrimary: img.isPrimary },
                            )

                    if (!images || images.length === 0) return null

                    return (
                        <div className="card-brutal p-6 mb-6">
                            <h2 className="text-lg font-bold uppercase text-stone-900 mb-4">ẢNH PHÒNG KHÁM</h2>
                            <div className="relative">
                                <div
                                    ref={scrollRef}
                                    className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                >
                                    {images.map((image, index) => (
                                        <div key={index} className="relative group min-w-[240px] md:min-w-[280px] snap-start">
                                            <div className="card-brutal overflow-hidden aspect-square">
                                                <img
                                                    src={image.url}
                                                    alt={`${currentClinic.name} - Image ${index + 1}`}
                                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                                                    onClick={() => window.open(image.url, '_blank')}
                                                />
                                            </div>
                                            {(image.isPrimary || index === 0) && (
                                                <div className="absolute top-2 left-2 bg-amber-600 text-white font-bold uppercase text-xs px-2 py-1 border-2 border-stone-900 shadow-brutal">
                                                    ẢNH ĐẠI DIỆN
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {canScrollLeft && (
                                    <button
                                        type="button"
                                        onClick={handleScrollLeft}
                                        className="hidden md:flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 w-10 h-14 bg-white/30 backdrop-blur border-2 border-white/60 shadow-xl transition hover:bg-white/70 hover:scale-105 active:scale-100"
                                    >
                                        <ChevronLeftIcon className="w-6 h-6 text-stone-900" />
                                    </button>
                                )}
                                {canScrollRight && (
                                    <button
                                        type="button"
                                        onClick={handleScrollRight}
                                        className="hidden md:flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 w-10 h-14 bg-white/30 backdrop-blur border-2 border-white/60 shadow-xl transition hover:bg-white/70 hover:scale-105 active:scale-100"
                                    >
                                        <ChevronRightIcon className="w-6 h-6 text-stone-900" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })()}

                {/* Basic Information */}
                <div className="card-brutal p-6 mb-6">
                    <h2 className="text-lg font-bold uppercase text-stone-900 mb-4">THÔNG TIN CƠ BẢN</h2>
                    <div className="space-y-3">
                        {currentClinic.description && (
                            <div>
                                <div className="text-sm font-bold uppercase text-stone-600 mb-1">MÔ TẢ</div>
                                <div className="text-stone-900">{currentClinic.description}</div>
                            </div>
                        )}
                        <div className="flex items-start gap-2">
                            <MapPinIcon className="w-5 h-5 text-stone-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="text-sm font-bold uppercase text-stone-600 mb-1">ĐỊA CHỈ</div>
                                <div className="text-stone-900">{currentClinic.address}</div>
                            </div>
                        </div>
                        {currentClinic.phone && (
                            <div className="flex items-center gap-2">
                                <PhoneIcon className="w-5 h-5 text-stone-600 flex-shrink-0" />
                                <div>
                                    <div className="text-sm font-bold uppercase text-stone-600 mb-1">SỐ ĐIỆN THOẠI</div>
                                    <div className="text-stone-900">{currentClinic.phone}</div>
                                </div>
                            </div>
                        )}
                        {currentClinic.email && (
                            <div className="flex items-center gap-2">
                                <EnvelopeIcon className="w-5 h-5 text-stone-600 flex-shrink-0" />
                                <div>
                                    <div className="text-sm font-bold uppercase text-stone-600 mb-1">EMAIL</div>
                                    <div className="text-stone-900">{currentClinic.email}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment & SOS Information */}
                <div className="card-brutal p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold uppercase text-stone-900">THANH TOÁN & DỊCH VỤ SOS</h2>
                        {!isEditingPayment ? (
                            <button
                                onClick={handleStartEditingPayment}
                                className="p-2 hover:bg-stone-100 border-2 border-transparent hover:border-black transition-all"
                                title="Chỉnh sửa nhanh"
                            >
                                <PencilIcon className="w-5 h-5 text-stone-600" />
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCancelEditingPayment}
                                    disabled={isSaving}
                                    className="px-3 py-1 text-xs font-bold uppercase border-2 border-black hover:bg-stone-100 disabled:opacity-50"
                                >
                                    HỦY
                                </button>
                                <button
                                    onClick={handleSavePayment}
                                    disabled={isSaving}
                                    className="px-3 py-1 text-xs font-bold uppercase bg-black text-white hover:bg-stone-800 disabled:opacity-50"
                                >
                                    {isSaving ? 'ĐANG LƯU...' : 'LƯU '}
                                </button>
                            </div>
                        )}
                    </div>

                    {isEditingPayment ? (
                        <div className="space-y-6">
                            {/* SOS Fee Edit */}
                            <div className="p-5 border-4 border-red-600 bg-red-50">
                                <label className="block text-sm font-black uppercase text-red-800 mb-2">
                                    PHÍ CẤP CỨU (SOS) - VNĐ
                                </label>
                                <input
                                    type="number"
                                    value={editPaymentData.sosFee}
                                    onChange={(e) => setEditPaymentData(prev => ({ ...prev, sosFee: Number(e.target.value) }))}
                                    className="w-full p-4 border-4 border-black font-black text-2xl text-red-600 focus:outline-none focus:ring-4 focus:ring-red-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                    placeholder="Nhập phí SOS..."
                                    min={0}
                                />
                                <p className="text-xs text-red-700 font-bold uppercase mt-3">
                                    Phí này sẽ được cộng vào tổng bill cho các booking SOS.
                                </p>
                            </div>

                            {/* Read-only Bank Info for Manager */}
                            <div className="p-4 border-2 border-dashed border-stone-300 bg-stone-50 opacity-80">
                                <div className="text-xs font-black text-stone-400 uppercase mb-3 flex items-center gap-2">
                                    <span className="bg-stone-200 px-2 py-0.5">CHỈ ĐỌC</span>
                                    THÔNG TIN NGÂN HÀNG (CHỈ CHỦ PHÒNG KHÁM CÓ QUYỀN THAY ĐỔI)
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase text-stone-500 mb-1">NGÂN HÀNG</div>
                                        <div className="text-sm font-bold text-stone-800">
                                            {VIETQR_BANKS.find(b => b.code === currentClinic.bankName)?.shortName || currentClinic.bankName || 'Chưa cấu hình'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase text-stone-500 mb-1">SỐ TÀI KHOẢN</div>
                                        <div className="text-sm font-mono font-bold text-stone-800">
                                            {currentClinic.accountNumber || 'Chưa cấu hình'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {currentClinic.sosFee && currentClinic.sosFee > 0 ? (
                                <div className="mb-6 p-4 border-4 border-red-600 bg-red-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div>
                                        <div className="text-lg font-black uppercase text-red-800 tracking-tight">PHÍ CẤP CỨU (SOS)</div>
                                        <div className="text-xs text-red-700 font-bold uppercase">Áp dụng khẩn cấp cho các dịch vụ cứu hộ lưu động</div>
                                    </div>
                                    <div className="text-2xl font-black text-red-600 bg-white px-4 py-2 border-2 border-red-600 shadow-[4px_4px_0px_#dc2626]">
                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentClinic.sosFee)}
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-6 p-4 border-4 border-stone-400 bg-stone-50 text-center">
                                    <div className="text-sm font-bold uppercase text-stone-500">CHƯA CẤU HÌNH PHÍ CẤP CỨU SOS</div>
                                    <button onClick={handleStartEditingPayment} className="text-xs font-black uppercase text-amber-600 underline mt-1 block w-full">
                                        CẤU HÌNH NGAY
                                    </button>
                                </div>
                            )}

                            {currentClinic.bankName && currentClinic.accountNumber && (
                                <div className={`flex flex-col md:flex-row gap-6 items-center md:items-start ${currentClinic.sosFee ? 'pt-6 border-t-2 border-dashed border-stone-200' : ''}`}>
                                    <div className="flex-shrink-0">
                                        <div className="w-48 h-48 border-4 border-stone-900 shadow-brutal overflow-hidden bg-white">
                                            <img
                                                src={`https://img.vietqr.io/image/${currentClinic.bankName}-${currentClinic.accountNumber}-compact2.jpg`}
                                                alt="VietQR Code"
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <div className="mb-3">
                                            <div className="text-sm font-bold uppercase text-stone-600 mb-1">NGÂN HÀNG</div>
                                            <div className="text-lg font-bold text-stone-900">
                                                {VIETQR_BANKS.find(b => b.code === currentClinic.bankName)?.shortName || currentClinic.bankName}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold uppercase text-stone-600 mb-1">SỐ TÀI KHOẢN</div>
                                            <div className="text-xl font-mono font-bold text-stone-900 tracking-wider">
                                                {currentClinic.accountNumber}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Operating Hours */}
                {currentClinic.operatingHours && (
                    <div className="card-brutal p-6 mb-6">
                        <h2 className="text-lg font-bold uppercase text-stone-900 mb-4">GIỜ LÀM VIỆC</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {DAYS_OF_WEEK.map((day) => {
                                const hours = currentClinic.operatingHours?.[day]
                                if (!hours) return null
                                return (
                                    <div key={day} className="border-2 border-stone-900 p-3">
                                        <div className="text-sm font-bold uppercase text-stone-900 mb-1">{DAY_LABELS[day]}</div>
                                        {hours.isClosed ? (
                                            <div className="text-stone-400 font-bold uppercase text-xs">ĐÓNG CỬA</div>
                                        ) : (
                                            <div className="text-stone-900 font-bold">
                                                {hours.openTime} - {hours.closeTime}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Map */}
                {currentClinic.latitude && currentClinic.longitude && (
                    <div className="card-brutal p-6">
                        <h2 className="text-lg font-bold uppercase text-stone-900 mb-4">VỊ TRÍ PHÒNG KHÁM</h2>
                        <ClinicMapOSM clinic={currentClinic} />
                    </div>
                )}
            </div>
        </div>
    )
}
