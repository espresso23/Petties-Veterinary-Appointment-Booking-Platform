import { useState, useEffect, useCallback } from 'react'
import {
    TicketIcon,
    PlusCircleIcon,
    XCircleIcon,
    CheckCircleIcon,
    TagIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { useToast } from '../../../hooks/useToast'
import apiClient from '../../../services/api/client'

// ==================== TYPES ====================
interface ClinicVoucher {
    clinicVoucherId: string
    voucherId: string
    code: string
    name: string
    description?: string
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
    discountValue: number
    maxDiscountAmount?: number
    minOrderAmount: number
    applicableCategory?: string
    requireOnlinePayment?: boolean
    limitOnePerUser?: boolean
    usedCount: number
    startDate: string
    endDate: string
    voucherActive: boolean
    isVoucherValid: boolean
    isEnabled: boolean
    appliedAt: string
    appliedByName?: string
}

interface AvailableVoucher {
    voucherId: string
    code: string
    name: string
    description?: string
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
    discountValue: number
    maxDiscountAmount?: number
    minOrderAmount: number
    applicableCategory?: string
    requireOnlinePayment?: boolean
    limitOnePerUser?: boolean
    usedCount: number
    startDate: string
    endDate: string
    isActive: boolean
    isValid: boolean
}

const SERVICE_CATEGORIES: Record<string, string> = {
    KHAM: 'Khám bệnh',
    GROOMING_SPA: 'Grooming & Spa',
    VACCINATION: 'Tiêm phòng',
    CHECK_UP: 'Khám tổng quát',
    SURGERY: 'Phẫu thuật',
    DENTAL: 'Nha khoa',
    DERMATOLOGY: 'Da liễu',
    OTHER: 'Khác',
}

function formatVND(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
}

function categoryLabel(cat?: string): string {
    if (!cat) return 'Tất cả dịch vụ'
    return SERVICE_CATEGORIES[cat] ?? cat
}

// ==================== CONFIRM MODAL ====================
interface ConfirmModalProps {
    open: boolean
    title: string
    message: string
    onConfirm: () => void
    onCancel: () => void
    isLoading?: boolean
    isDanger?: boolean
}
function ConfirmModal({ open, title, message, onConfirm, onCancel, isLoading, isDanger }: ConfirmModalProps) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60">
            <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[6px_6px_0_#1c1917] w-full max-w-md">
                <div className="p-6">
                    <div className="flex items-start gap-3 mb-1">
                        <div className={`w-10 h-10 rounded-lg border-2 border-stone-900 flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0_#1c1917] ${isDanger ? 'bg-red-50' : 'bg-amber-50'}`}>
                            <ExclamationTriangleIcon className={`w-5 h-5 ${isDanger ? 'text-red-500' : 'text-amber-600'}`} />
                        </div>
                        <div>
                            <h3 className="font-bold text-stone-900 text-lg">{title}</h3>
                            <p className="text-stone-600 text-sm mt-1 font-medium">{message}</p>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onCancel} disabled={isLoading}
                        className="flex-1 py-2.5 rounded-lg border-2 border-stone-900 bg-white text-stone-800 font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:bg-stone-100 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        Hủy
                    </button>
                    <button onClick={onConfirm} disabled={isLoading}
                        className={`flex-1 py-2.5 rounded-lg border-2 border-stone-900 text-white font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 transition-all disabled:opacity-50 ${isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}>
                        {isLoading ? 'Đang xử lý...' : 'Xác nhận'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== PICK VOUCHER MODAL ====================
interface PickVoucherModalProps {
    open: boolean
    available: AvailableVoucher[]
    appliedIds: Set<string>
    onApply: (voucherId: string) => void
    onClose: () => void
    isApplying: boolean
}
function PickVoucherModal({ open, available, appliedIds, onApply, onClose, isApplying }: PickVoucherModalProps) {
    const [search, setSearch] = useState('')
    if (!open) return null

    const filtered = available.filter(v =>
        v.code.toLowerCase().includes(search.toLowerCase()) ||
        v.name.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 overflow-y-auto">
            <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[6px_6px_0_#1c1917] w-full max-w-2xl my-4">
                <div className="flex items-center justify-between p-6 border-b-2 border-stone-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-400 border-2 border-stone-900 flex items-center justify-center shadow-[2px_2px_0_#1c1917]">
                            <TicketIcon className="w-5 h-5 text-stone-900" />
                        </div>
                        <h2 className="text-xl font-black text-stone-900">Áp Dụng Voucher</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                        <XMarkIcon className="w-5 h-5 text-stone-600" />
                    </button>
                </div>

                <div className="p-5">
                    <p className="text-sm text-stone-500 font-medium mb-4">
                        Chọn voucher bạn muốn áp dụng cho phòng khám. Pet owner sẽ thấy voucher này khi thanh toán.
                    </p>
                    <div className="relative mb-4">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Tìm voucher..."
                            className="w-full pl-9 pr-4 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm" />
                    </div>

                    <div className="space-y-3 max-h-80 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="text-center py-10 text-stone-400">
                                <TagIcon className="w-12 h-12 mx-auto mb-2" />
                                <p className="font-medium">Không có voucher nào</p>
                            </div>
                        ) : filtered.map(v => {
                            const alreadyApplied = appliedIds.has(v.voucherId)
                            return (
                                <div key={v.voucherId}
                                    className={`border-2 rounded-xl p-4 flex items-center justify-between gap-3 transition-all ${alreadyApplied ? 'border-stone-200 bg-stone-50' : 'border-stone-900 shadow-[3px_3px_0_#1c1917] hover:shadow-[4px_4px_0_#1c1917] hover:-translate-y-0.5'}`}>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="px-1.5 py-0.5 bg-stone-900 text-white text-[10px] font-black rounded font-mono">{v.code}</span>
                                            {alreadyApplied && (
                                                <span className="text-[10px] font-bold text-teal-600 uppercase">Đã áp dụng</span>
                                            )}
                                        </div>
                                        <p className="font-bold text-stone-900 text-sm truncate">{v.name}</p>
                                        <p className="text-xs text-stone-500">
                                            {v.discountType === 'PERCENTAGE'
                                                ? `Giảm ${v.discountValue}%`
                                                : `Giảm ${formatVND(v.discountValue)}`
                                            } · Tối thiểu {formatVND(v.minOrderAmount)}
                                        </p>
                                        <p className="text-xs text-stone-400">HSD: {formatDate(v.startDate)} – {formatDate(v.endDate)}</p>
                                    </div>
                                    <button
                                        onClick={() => !alreadyApplied && onApply(v.voucherId)}
                                        disabled={alreadyApplied || isApplying}
                                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase rounded-lg border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] transition-all disabled:opacity-50 ${alreadyApplied
                                            ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                            : 'bg-amber-500 hover:bg-amber-600 text-white hover:-translate-y-0.5'}`}>
                                        {alreadyApplied ? <CheckCircleIcon className="w-4 h-4" /> : <PlusCircleIcon className="w-4 h-4" />}
                                        {alreadyApplied ? 'Đã áp dụng' : 'Áp dụng'}
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="p-5 border-t-2 border-stone-900">
                    <button onClick={onClose}
                        className="w-full py-2.5 rounded-lg border-2 border-stone-900 bg-white text-stone-800 font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:bg-stone-100 hover:-translate-y-0.5 transition-all">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== CLINIC VOUCHER CARD ====================
interface ClinicVoucherCardProps {
    cv: ClinicVoucher
    onRemove: (cv: ClinicVoucher) => void
}
function ClinicVoucherCard({ cv, onRemove }: ClinicVoucherCardProps) {
    const isActive = cv.isEnabled && cv.voucherActive && cv.isVoucherValid
    const isPercent = cv.discountType === 'PERCENTAGE'

    return (
        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] flex flex-col hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#1c1917] transition-all">
            <div className={`h-1.5 rounded-t-xl ${isActive ? 'bg-teal-500' : 'bg-stone-300'}`} />

            <div className="p-5 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-stone-900 text-white text-xs font-black rounded font-mono">{cv.code}</span>
                            {!cv.isEnabled && (
                                <span className="text-[10px] font-bold text-red-600 uppercase border border-red-300 rounded-full px-1.5 py-0.5">Admin tắt</span>
                            )}
                            {cv.isEnabled && !cv.isVoucherValid && (
                                <span className="text-[10px] font-bold text-stone-500 uppercase border border-stone-300 rounded-full px-1.5 py-0.5">Hết hạn</span>
                            )}
                            {isActive && (
                                <span className="text-[10px] font-bold text-teal-600 uppercase border border-teal-300 rounded-full px-1.5 py-0.5">Hoạt động</span>
                            )}
                        </div>
                        <h3 className="font-bold text-stone-900 text-base">{cv.name}</h3>
                        {cv.description && (
                            <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{cv.description}</p>
                        )}
                    </div>
                </div>

                {/* Discount */}
                <div className={`rounded-lg p-3 border-2 mb-3 ${isPercent ? 'bg-amber-50 border-amber-400' : 'bg-teal-50 border-teal-400'}`}>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-2xl font-black ${isPercent ? 'text-amber-600' : 'text-teal-600'}`}>
                            {isPercent ? `${cv.discountValue}%` : formatVND(cv.discountValue)}
                        </span>
                        <span className="text-sm text-stone-500 font-medium">giảm</span>
                    </div>
                    {isPercent && cv.maxDiscountAmount && (
                        <p className="text-xs text-stone-500 mt-0.5">Tối đa {formatVND(cv.maxDiscountAmount)}</p>
                    )}
                </div>

                <div className="space-y-1.5 text-xs mb-3">
                    <div className="flex justify-between">
                        <span className="text-stone-500 font-bold uppercase">Đơn tối thiểu</span>
                        <span className="font-semibold text-stone-800">{formatVND(cv.minOrderAmount)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-stone-500 font-bold uppercase">Dịch vụ</span>
                        <span className="font-semibold text-stone-800">{categoryLabel(cv.applicableCategory)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-stone-500 font-bold uppercase">Hiệu lực</span>
                        <span className="font-semibold text-stone-800">{formatDate(cv.startDate)} – {formatDate(cv.endDate)}</span>
                    </div>
                    {cv.limitOnePerUser && (
                        <div className="flex justify-between">
                            <span className="text-stone-500 font-bold uppercase">Lượt dùng</span>
                            <span className="font-semibold text-stone-800">1 lượt/Khách</span>
                        </div>
                    )}
                    {cv.requireOnlinePayment && (
                        <div className="flex justify-between mt-1">
                            <span className="text-amber-600 font-bold uppercase">Lưu ý</span>
                            <span className="font-semibold text-amber-700">Chỉ dùng Online/QR</span>
                        </div>
                    )}
                </div>

                <p className="text-[10px] text-stone-400 font-medium">
                    Áp dụng lúc: {new Date(cv.appliedAt).toLocaleDateString('vi-VN')}
                    {cv.appliedByName && ` bởi ${cv.appliedByName}`}
                </p>
            </div>

            <div className="px-5 pb-5">
                <button onClick={() => onRemove(cv)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase rounded-lg border-2 border-stone-900 bg-white text-red-600 hover:bg-red-50 shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#1c1917] transition-all">
                    <XCircleIcon className="w-4 h-4" />
                    Gỡ Voucher
                </button>
            </div>
        </div>
    )
}

// ==================== MAIN PAGE ====================
export const ClinicManagerVoucherPage = () => {
    const { showToast } = useToast()
    const [myVouchers, setMyVouchers] = useState<ClinicVoucher[]>([])
    const [available, setAvailable] = useState<AvailableVoucher[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [showPicker, setShowPicker] = useState(false)
    const [confirmRemove, setConfirmRemove] = useState<ClinicVoucher | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const loadMyVouchers = useCallback(async () => {
        try {
            setIsLoading(true)
            const res = await apiClient.get('/vouchers/clinic-manager/my-vouchers')
            setMyVouchers(res.data.clinicVouchers || [])
        } catch {
            showToast('error', 'Không thể tải danh sách voucher')
        } finally {
            setIsLoading(false)
        }
    }, [showToast])

    const loadAvailable = useCallback(async () => {
        try {
            const res = await apiClient.get('/vouchers/clinic-manager/available')
            setAvailable(res.data.vouchers || [])
        } catch {
            // silent
        }
    }, [])

    useEffect(() => { loadMyVouchers() }, [loadMyVouchers])

    const handleOpenPicker = () => {
        loadAvailable()
        setShowPicker(true)
    }

    const handleApply = async (voucherId: string) => {
        try {
            setIsSubmitting(true)
            await apiClient.post(`/vouchers/clinic-manager/apply/${voucherId}`)
            showToast('success', 'Đã áp dụng voucher vào phòng khám!')
            loadMyVouchers()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Áp dụng thất bại'
            showToast('error', msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleRemove = async () => {
        if (!confirmRemove) return
        try {
            setIsSubmitting(true)
            await apiClient.delete(`/vouchers/clinic-manager/${confirmRemove.clinicVoucherId}`)
            showToast('success', 'Đã gỡ voucher khỏi phòng khám')
            setConfirmRemove(null)
            loadMyVouchers()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gỡ voucher thất bại'
            showToast('error', msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const appliedIds = new Set(myVouchers.map(cv => cv.voucherId))
    const activeCount = myVouchers.filter(cv => cv.isEnabled && cv.voucherActive && cv.isVoucherValid).length

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-900 flex items-center gap-3">
                        <TicketIcon className="w-8 h-8 text-amber-600" />
                        Voucher Phòng Khám
                    </h1>
                    <p className="text-stone-500 font-medium mt-1">
                        Quản lý voucher đang áp dụng cho phòng khám của bạn
                    </p>
                </div>
                <div className="flex gap-3">
                    <button onClick={loadMyVouchers}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white text-stone-700 font-bold text-sm uppercase rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:bg-stone-100 hover:-translate-y-0.5 transition-all">
                        <ArrowPathIcon className="w-4 h-4" />
                        Làm mới
                    </button>
                    <button onClick={handleOpenPicker}
                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm uppercase rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] transition-all">
                        <PlusCircleIcon className="w-5 h-5" />
                        Áp Dụng Voucher
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
                    <p className="text-xs font-bold uppercase text-stone-500 mb-1">Tổng voucher</p>
                    <p className="text-3xl font-black text-stone-900">{myVouchers.length}</p>
                </div>
                <div className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
                    <p className="text-xs font-bold uppercase text-stone-500 mb-1">Đang hoạt động</p>
                    <p className="text-3xl font-black text-teal-600">{activeCount}</p>
                </div>
                <div className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
                    <p className="text-xs font-bold uppercase text-stone-500 mb-1">Không hoạt động</p>
                    <p className="text-3xl font-black text-stone-400">{myVouchers.length - activeCount}</p>
                </div>
            </div>

            {/* Notice */}
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 mb-6 shadow-[3px_3px_0_#1c1917]">
                <p className="text-sm font-medium text-amber-800">
                    <span className="font-black">Lưu ý:</span> Voucher do Admin quản lý việc bật/tắt. 
                    Chỉ những voucher đang <span className="font-bold">Hoạt động</span> mới hiển thị cho pet owner khi thanh toán.
                </p>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-[4px] border-stone-200 border-t-amber-500" />
                </div>
            ) : myVouchers.length === 0 ? (
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-16 text-center">
                    <TagIcon className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-800">Chưa có voucher nào</h3>
                    <p className="text-stone-500 font-medium mt-2">Nhấn "Áp Dụng Voucher" để thêm voucher vào phòng khám</p>
                    <button onClick={handleOpenPicker}
                        className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm uppercase rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 transition-all">
                        <PlusCircleIcon className="w-5 h-5" />
                        Áp Dụng Ngay
                    </button>
                </div>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {myVouchers.map(cv => (
                        <ClinicVoucherCard
                            key={cv.clinicVoucherId}
                            cv={cv}
                            onRemove={setConfirmRemove}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            <PickVoucherModal
                open={showPicker}
                available={available}
                appliedIds={appliedIds}
                onApply={handleApply}
                onClose={() => setShowPicker(false)}
                isApplying={isSubmitting}
            />

            <ConfirmModal
                open={!!confirmRemove}
                title="Gỡ Voucher"
                message={`Bạn có chắc muốn gỡ voucher "${confirmRemove?.name}" khỏi phòng khám?`}
                onConfirm={handleRemove}
                onCancel={() => setConfirmRemove(null)}
                isLoading={isSubmitting}
                isDanger
            />
        </div>
    )
}

export default ClinicManagerVoucherPage
