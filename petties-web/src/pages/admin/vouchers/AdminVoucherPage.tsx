import { useState, useEffect, useCallback } from 'react'
import {
    TicketIcon,
    PlusIcon,
    TrashIcon,
    CheckCircleIcon,
    XCircleIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    TagIcon,
    PencilSquareIcon,
} from '@heroicons/react/24/outline'
import { useToast } from '../../../hooks/useToast'
import apiClient from '../../../services/api/client'

// ==================== TYPES ====================
interface Voucher {
    voucherId: string
    code: string
    name: string
    description?: string
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
    discountValue: number
    maxDiscountAmount?: number
    minOrderAmount: number
    applicableCategory?: string
    usageLimit?: number
    usedCount: number
    startDate: string
    endDate: string
    isActive: boolean
    isValid: boolean
    requireOnlinePayment?: boolean
    limitOnePerUser?: boolean
    createdAt: string
    createdByName?: string
}

interface CreateVoucherForm {
    code: string
    name: string
    description: string
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT'
    discountValue: string
    maxDiscountAmount: string
    minOrderAmount: string
    applicableCategory: string
    requireOnlinePayment: boolean
    limitOnePerUser: boolean
    startDate: string
    endDate: string
}

const SERVICE_CATEGORIES = [
    { value: '', label: 'Tất cả dịch vụ' },
    { value: 'KHAM', label: 'Khám bệnh' },
    { value: 'GROOMING_SPA', label: 'Grooming & Spa' },
    { value: 'VACCINATION', label: 'Tiêm phòng' },
    { value: 'CHECK_UP', label: 'Khám tổng quát' },
    { value: 'SURGERY', label: 'Phẫu thuật' },
    { value: 'DENTAL', label: 'Nha khoa' },
    { value: 'DERMATOLOGY', label: 'Da liễu' },
    { value: 'OTHER', label: 'Khác' },
]

function formatVND(amount: number | undefined): string {
    if (amount == null) return '—'
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}

function formatDate(dateStr: string): string {
    if (!dateStr) return '—'
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
}

function categoryLabel(cat?: string): string {
    if (!cat) return 'Tất cả dịch vụ'
    return SERVICE_CATEGORIES.find(c => c.value === cat)?.label ?? cat
}

// ==================== STATUS BADGE ====================
function StatusBadge({ isActive, isValid }: { isActive: boolean; isValid: boolean }) {
    if (!isActive) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold bg-stone-100 text-stone-500 border-stone-300">
                Tắt
            </span>
        )
    }
    if (!isValid) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold bg-red-100 text-red-700 border-red-300">
                Hết hạn
            </span>
        )
    }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold bg-teal-100 text-teal-700 border-teal-400">
            Hoạt động
        </span>
    )
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
                    <div className="flex items-start gap-3 mb-4">
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

// ==================== CREATE & UPDATE MODAL ====================
interface CreateModalProps {
    open: boolean
    onClose: () => void
    onCreated: () => void
    initialData?: Voucher | null
}
function CreateVoucherModal({ open, onClose, onCreated, initialData }: CreateModalProps) {
    const { showToast } = useToast()
    const today = new Date().toISOString().split('T')[0]
    
    // Default form
    const defaultForm = {
        code: '', name: '', description: '', discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
        discountValue: '', maxDiscountAmount: '', minOrderAmount: '0',
        applicableCategory: '', requireOnlinePayment: false, limitOnePerUser: false, startDate: today, endDate: '',
    };
    
    const [form, setForm] = useState<CreateVoucherForm>(defaultForm)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (open && initialData) {
            setForm({
                code: initialData.code,
                name: initialData.name,
                description: initialData.description || '',
                discountType: initialData.discountType,
                discountValue: initialData.discountValue.toString(),
                maxDiscountAmount: initialData.maxDiscountAmount ? initialData.maxDiscountAmount.toString() : '',
                minOrderAmount: initialData.minOrderAmount.toString(),
                applicableCategory: initialData.applicableCategory || '',
                requireOnlinePayment: initialData.requireOnlinePayment || false,
                limitOnePerUser: initialData.limitOnePerUser || false,
                startDate: initialData.startDate,
                endDate: initialData.endDate,
            });
        } else if (open && !initialData) {
            setForm(defaultForm);
        }
    }, [open, initialData])

    const set = (key: keyof CreateVoucherForm, value: string | boolean) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const handleSubmit = async () => {
        if (!form.code || !form.name || !form.discountValue || !form.startDate || !form.endDate) {
            showToast('error', 'Vui lòng điền đầy đủ thông tin bắt buộc')
            return
        }
        try {
            setIsSubmitting(true)
            const payload = {
                code: form.code.toUpperCase(),
                name: form.name,
                description: form.description || undefined,
                discountType: form.discountType,
                discountValue: parseFloat(form.discountValue),
                maxDiscountAmount: form.maxDiscountAmount ? parseFloat(form.maxDiscountAmount) : undefined,
                minOrderAmount: parseFloat(form.minOrderAmount) || 0,
                applicableCategory: form.applicableCategory || undefined,
                requireOnlinePayment: form.requireOnlinePayment,
                limitOnePerUser: form.limitOnePerUser,
                startDate: form.startDate,
                endDate: form.endDate,
            }
            if (initialData) {
                await apiClient.put(`/vouchers/admin/${initialData.voucherId}`, payload)
                showToast('success', 'Cập nhật voucher thành công!')
            } else {
                await apiClient.post('/vouchers/admin', payload)
                showToast('success', 'Tạo voucher thành công!')
            }
            onCreated()
            onClose()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : (err as { response?: { data?: { message?: string } } })?.response?.data?.message || (initialData ? 'Cập nhật thất bại' : 'Tạo voucher thất bại')
            showToast('error', msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 overflow-y-auto">
            <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[6px_6px_0_#1c1917] w-full max-w-2xl my-4">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b-2 border-stone-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-400 border-2 border-stone-900 flex items-center justify-center shadow-[2px_2px_0_#1c1917]">
                            <TicketIcon className="w-5 h-5 text-stone-900" />
                        </div>
                        <h2 className="text-xl font-black text-stone-900">{initialData ? 'Cập Nhật Voucher' : 'Tạo Voucher Mới'}</h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                        <XMarkIcon className="w-5 h-5 text-stone-600" />
                    </button>
                </div>

                {/* Form */}
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Code + Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Mã Voucher *</label>
                            <input type="text" value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                                placeholder="VD: SUMMER2025" disabled={!!initialData}
                                className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-bold text-sm uppercase disabled:opacity-60 disabled:bg-stone-100" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Tên Voucher *</label>
                            <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                                placeholder="Tên hiển thị..."
                                className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm" />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Mô Tả</label>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)}
                            rows={2} placeholder="Mô tả điều kiện..."
                            className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm resize-none" />
                    </div>

                    {/* Discount Type + Value */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Loại Giảm *</label>
                            <select value={form.discountType} onChange={e => set('discountType', e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}
                                className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm">
                                <option value="PERCENTAGE">Giảm %</option>
                                <option value="FIXED_AMOUNT">Giảm cố định (VND)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">
                                {form.discountType === 'PERCENTAGE' ? 'Phần Trăm (%)' : 'Số Tiền (VND)'} *
                            </label>
                            <input type="number" value={form.discountValue} onChange={e => set('discountValue', e.target.value)}
                                min="0" max={form.discountType === 'PERCENTAGE' ? '100' : undefined}
                                placeholder={form.discountType === 'PERCENTAGE' ? '20' : '50000'}
                                className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm" />
                        </div>
                        {form.discountType === 'PERCENTAGE' && (
                            <div>
                                <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Giảm Tối Đa (VND)</label>
                                <input type="number" value={form.maxDiscountAmount} onChange={e => set('maxDiscountAmount', e.target.value)}
                                    min="0" placeholder="Không giới hạn"
                                    className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm" />
                            </div>
                        )}
                    </div>

                    {/* Conditions */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Đơn Tối Thiểu (VND) *</label>
                            <input type="number" value={form.minOrderAmount} onChange={e => set('minOrderAmount', e.target.value)}
                                min="0" placeholder="0"
                                className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Loại Dịch Vụ Áp Dụng</label>
                            <select value={form.applicableCategory} onChange={e => set('applicableCategory', e.target.value)}
                                className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm">
                                {SERVICE_CATEGORIES.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {/* Date + Tùy chọn */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Ngày Bắt Đầu *</label>
                            <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                                className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Ngày Kết Thúc *</label>
                            <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)}
                                min={form.startDate}
                                className="w-full px-3 py-2.5 border-2 border-stone-900 rounded-lg bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-stone-500 mb-1.5">Tùy Chọn Thêm</label>
                            <div className="space-y-2 mt-2">
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="checkbox" checked={form.limitOnePerUser} onChange={e => set('limitOnePerUser', e.target.checked)} className="w-4 h-4 mt-0.5 text-amber-600 rounded border-stone-900 focus:ring-amber-500" />
                                    <span className="text-sm font-medium text-stone-700 leading-tight">Mỗi khách hàng 1 lần</span>
                                </label>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="checkbox" checked={form.requireOnlinePayment} onChange={e => set('requireOnlinePayment', e.target.checked)} className="w-4 h-4 mt-0.5 text-amber-600 rounded border-stone-900 focus:ring-amber-500" />
                                    <span className="text-sm font-medium text-stone-700 leading-tight">Chỉ giao dịch Online</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t-2 border-stone-900">
                    <button onClick={onClose} disabled={isSubmitting}
                        className="flex-1 py-2.5 rounded-lg border-2 border-stone-900 bg-white text-stone-800 font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:bg-stone-100 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        Hủy
                    </button>
                    <button onClick={handleSubmit} disabled={isSubmitting}
                        className="flex-1 py-2.5 rounded-lg border-2 border-stone-900 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        {isSubmitting ? 'Đang xử lý...' : (initialData ? 'Cập Nhật Voucher' : 'Tạo Voucher')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== VOUCHER CARD ====================
interface VoucherCardProps {
    voucher: Voucher
    onToggle: (id: string) => void
    onEdit: (voucher: Voucher) => void
    onDelete: (voucher: Voucher) => void
}
function VoucherCard({ voucher, onToggle, onEdit, onDelete }: VoucherCardProps) {
    const isPercent = voucher.discountType === 'PERCENTAGE'
    return (
        <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] flex flex-col hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#1c1917] transition-all">
            {/* Top stripe */}
            <div className={`h-1.5 rounded-t-xl ${voucher.isActive && voucher.isValid ? 'bg-teal-500' : 'bg-stone-300'}`} />

            <div className="p-5 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-stone-900 text-white text-xs font-black rounded-md font-mono">
                                {voucher.code}
                            </span>
                            <StatusBadge isActive={voucher.isActive} isValid={voucher.isValid} />
                        </div>
                        <h3 className="font-bold text-stone-900 text-base leading-tight">{voucher.name}</h3>
                        {voucher.description && (
                            <p className="text-xs text-stone-500 font-medium mt-0.5 line-clamp-2">{voucher.description}</p>
                        )}
                    </div>
                </div>

                {/* Discount value highlight */}
                <div className={`rounded-lg p-3 border-2 mb-3 ${isPercent ? 'bg-amber-50 border-amber-400' : 'bg-teal-50 border-teal-400'}`}>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-3xl font-black ${isPercent ? 'text-amber-600' : 'text-teal-600'}`}>
                            {isPercent ? `${voucher.discountValue}%` : formatVND(voucher.discountValue)}
                        </span>
                        <span className="text-sm text-stone-500 font-medium">giảm</span>
                    </div>
                    {isPercent && voucher.maxDiscountAmount && (
                        <p className="text-xs text-stone-500 mt-0.5">Tối đa {formatVND(voucher.maxDiscountAmount)}</p>
                    )}
                </div>

                {/* Conditions */}
                <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs">
                        <span className="text-stone-500 font-bold uppercase">Đơn tối thiểu</span>
                        <span className="font-semibold text-stone-800">{formatVND(voucher.minOrderAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-stone-500 font-bold uppercase">Dịch vụ</span>
                        <span className="font-semibold text-stone-800">{categoryLabel(voucher.applicableCategory)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-stone-500 font-bold uppercase">Thời hạn</span>
                        <span className="font-semibold text-stone-800">{formatDate(voucher.startDate)} – {formatDate(voucher.endDate)}</span>
                    </div>
                    {voucher.limitOnePerUser && (
                        <div className="flex justify-between text-xs">
                            <span className="text-stone-500 font-bold uppercase">Lượt dùng</span>
                            <span className="font-semibold text-stone-800">1 lần/Khách</span>
                        </div>
                    )}
                    {voucher.requireOnlinePayment && (
                        <div className="flex justify-between text-xs mt-1">
                            <span className="text-amber-600 font-bold uppercase">Lưu ý</span>
                            <span className="font-semibold text-amber-700">Thanh toán Online/QR</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-2">
                <button onClick={() => onToggle(voucher.voucherId)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold uppercase rounded-lg border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#1c1917] transition-all ${voucher.isActive
                        ? 'bg-white text-stone-700 hover:bg-stone-100'
                        : 'bg-teal-500 hover:bg-teal-600 text-white'}`}>
                    {voucher.isActive
                        ? <><XCircleIcon className="w-4 h-4" />Tắt</>
                        : <><CheckCircleIcon className="w-4 h-4" />Bật</>
                    }
                </button>
                <button onClick={() => onEdit(voucher)}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-bold uppercase rounded-lg border-2 border-stone-900 bg-white text-blue-600 hover:bg-blue-50 shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#1c1917] transition-all">
                    <PencilSquareIcon className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(voucher)}
                    className="flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-bold uppercase rounded-lg border-2 border-stone-900 bg-white text-red-600 hover:bg-red-50 shadow-[2px_2px_0_#1c1917] hover:-translate-y-0.5 hover:shadow-[3px_3px_0_#1c1917] transition-all">
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}

// ==================== MAIN PAGE ====================
export const AdminVoucherPage = () => {
    const { showToast } = useToast()
    const [vouchers, setVouchers] = useState<Voucher[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [editData, setEditData] = useState<Voucher | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<Voucher | null>(null)
    const [confirmToggle, setConfirmToggle] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const loadVouchers = useCallback(async () => {
        try {
            setIsLoading(true)
            const res = await apiClient.get('/vouchers/admin/all')
            setVouchers(res.data.vouchers || [])
        } catch {
            showToast('error', 'Không thể tải danh sách voucher')
        } finally {
            setIsLoading(false)
        }
    }, [showToast])

    useEffect(() => { loadVouchers() }, [loadVouchers])

    const handleToggle = async (id: string) => {
        try {
            setIsSubmitting(true)
            const res = await apiClient.patch(`/vouchers/admin/${id}/toggle-active`)
            showToast('success', res.data.message)
            setConfirmToggle(null)
            loadVouchers()
        } catch {
            showToast('error', 'Cập nhật thất bại')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!confirmDelete) return
        try {
            setIsSubmitting(true)
            await apiClient.delete(`/vouchers/admin/${confirmDelete.voucherId}`)
            showToast('success', 'Đã xóa voucher')
            setConfirmDelete(null)
            loadVouchers()
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Xóa voucher thất bại'
            showToast('error', msg)
        } finally {
            setIsSubmitting(false)
        }
    }

    const filtered = vouchers.filter(v =>
        v.code.toLowerCase().includes(search.toLowerCase()) ||
        v.name.toLowerCase().includes(search.toLowerCase())
    )

    const stats = {
        total: vouchers.length,
        active: vouchers.filter(v => v.isActive && v.isValid).length,
        inactive: vouchers.filter(v => !v.isActive).length,
        expired: vouchers.filter(v => v.isActive && !v.isValid).length,
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-stone-900 flex items-center gap-3">
                        <TicketIcon className="w-8 h-8 text-amber-600" />
                        Quản Lý Voucher
                    </h1>
                    <p className="text-stone-500 font-medium mt-1">Tạo và quản lý voucher giảm giá cho toàn hệ thống</p>
                </div>
                <button onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm uppercase rounded-lg border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_#1c1917] transition-all">
                    <PlusIcon className="w-5 h-5" />
                    Tạo Voucher
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Tổng voucher', value: stats.total, color: 'bg-stone-100 text-stone-700' },
                    { label: 'Đang hoạt động', value: stats.active, color: 'bg-teal-100 text-teal-700' },
                    { label: 'Đã tắt', value: stats.inactive, color: 'bg-stone-100 text-stone-500' },
                    { label: 'Hết hạn', value: stats.expired, color: 'bg-red-100 text-red-700' },
                ].map(s => (
                    <div key={s.label} className="bg-white border-2 border-stone-900 rounded-xl p-4 shadow-[4px_4px_0_#1c1917]">
                        <p className="text-xs font-bold uppercase text-stone-500 mb-1">{s.label}</p>
                        <p className={`text-3xl font-black ${s.color.split(' ')[1]}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="relative mb-6">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm theo mã hoặc tên voucher..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-stone-900 rounded-xl bg-white shadow-[2px_2px_0_#1c1917] focus:outline-none focus:border-amber-600 font-medium text-sm" />
                {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <XMarkIcon className="w-5 h-5 text-stone-400 hover:text-stone-700" />
                    </button>
                )}
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex justify-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-[4px] border-stone-200 border-t-amber-500" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white border-2 border-stone-900 rounded-xl shadow-[4px_4px_0_#1c1917] p-16 text-center">
                    <TagIcon className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-stone-800">
                        {search ? 'Không tìm thấy voucher' : 'Chưa có voucher nào'}
                    </h3>
                    <p className="text-stone-500 font-medium mt-2">
                        {search ? 'Thử thay đổi từ khóa tìm kiếm' : 'Tạo voucher đầu tiên để bắt đầu'}
                    </p>
                </div>
            ) : (
                <>
                    <p className="text-sm font-medium text-stone-500 mb-4">
                        Tìm thấy <span className="font-bold text-stone-800">{filtered.length}</span> voucher
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {filtered.map(v => (
                            <VoucherCard
                                key={v.voucherId}
                                voucher={v}
                                onToggle={() => setConfirmToggle(v.voucherId)}
                                onEdit={(voucher) => { setEditData(voucher); setShowCreate(true); }}
                                onDelete={setConfirmDelete}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Modals */}
            <CreateVoucherModal
                open={showCreate}
                initialData={editData}
                onClose={() => { setShowCreate(false); setEditData(null); }}
                onCreated={loadVouchers}
            />

            <ConfirmModal
                open={!!confirmToggle}
                title="Xác nhận thay đổi"
                message="Bạn có chắc muốn thay đổi trạng thái voucher này?"
                onConfirm={() => confirmToggle && handleToggle(confirmToggle)}
                onCancel={() => setConfirmToggle(null)}
                isLoading={isSubmitting}
            />

            <ConfirmModal
                open={!!confirmDelete}
                title="Xóa Voucher"
                message={`Bạn có chắc muốn xóa voucher "${confirmDelete?.name}"? Hành động này không thể hoàn tác.`}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete(null)}
                isLoading={isSubmitting}
                isDanger
            />
        </div>
    )
}

export default AdminVoucherPage
