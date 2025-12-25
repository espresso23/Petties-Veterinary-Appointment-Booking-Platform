import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type { QuickAddStaffRequest, StaffRole } from '../../types/clinicStaff'

interface QuickAddStaffModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: QuickAddStaffRequest) => Promise<void>
    allowedRoles?: StaffRole[]
    disabledRoles?: StaffRole[]
    title?: string
}

/**
 * Quick Add Staff Modal - Neobrutalism Design
 * Form to quickly add a new staff member
 */
export function QuickAddStaffModal({
    isOpen,
    onClose,
    onSubmit,
    allowedRoles = ['VET', 'CLINIC_MANAGER'],
    disabledRoles = [],
    title = 'THÊM NHÂN VIÊN MỚI',
}: QuickAddStaffModalProps) {
    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')
    const [role, setRole] = useState<StaffRole>(allowedRoles[0])
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Validation
        if (!fullName.trim()) {
            setError('Vui lòng nhập họ tên')
            return
        }

        if (!phone.trim()) {
            setError('Vui lòng nhập số điện thoại')
            return
        }

        const phoneRegex = /^[0-9]{10,11}$/
        if (!phoneRegex.test(phone)) {
            setError('Số điện thoại không hợp lệ (10-11 số)')
            return
        }

        setIsSubmitting(true)
        try {
            await onSubmit({ fullName: fullName.trim(), phone: phone.trim(), role })
            // Reset form
            setFullName('')
            setPhone('')
            setRole(allowedRoles[0])
            onClose()
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Có lỗi xảy ra')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        if (!isSubmitting) {
            setFullName('')
            setPhone('')
            setRole(allowedRoles[0])
            setError(null)
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-stone-900/50"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md card-brutal p-0 bg-white">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-stone-900">
                    <h2 className="text-lg font-bold uppercase text-stone-900">{title}</h2>
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="p-1 hover:bg-stone-100 transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6 text-stone-900" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-100 border-4 border-red-600 text-red-800 font-bold text-sm">
                            {error}
                        </div>
                    )}

                    {/* Full Name */}
                    <div>
                        <label className="block text-sm font-bold uppercase text-stone-700 mb-2">
                            HỌ VÀ TÊN
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Nguyễn Văn A"
                            className="input-brutal"
                            disabled={isSubmitting}
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-bold uppercase text-stone-700 mb-2">
                            SỐ ĐIỆN THOẠI
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="0901234567"
                            maxLength={11}
                            className="input-brutal"
                            disabled={isSubmitting}
                        />
                        <p className="mt-1 text-xs text-stone-500">
                            Mật khẩu mặc định: 6 số cuối SĐT
                        </p>
                    </div>

                    {/* Role */}
                    <div>
                        <label className="block text-sm font-bold uppercase text-stone-700 mb-2">
                            VAI TRÒ
                        </label>
                        <div className="flex gap-3">
                            {allowedRoles.includes('VET') && (
                                <label
                                    className={`flex-1 min-h-[64px] flex items-center justify-center p-2 border-4 border-stone-900 cursor-pointer transition-all text-center font-bold uppercase text-[10px] sm:text-xs ${role === 'VET'
                                        ? 'bg-green-200 text-green-900 shadow-[6px_6px_0_#000] -translate-x-1 -translate-y-1'
                                        : 'bg-green-50 text-green-700 shadow-none opacity-70 hover:opacity-100 hover:bg-green-100'
                                        } ${disabledRoles.includes('VET') ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value="VET"
                                        checked={role === 'VET'}
                                        onChange={() => setRole('VET')}
                                        className="sr-only"
                                        disabled={isSubmitting || disabledRoles.includes('VET')}
                                    />
                                    BÁC SĨ THÚ Y
                                </label>
                            )}
                            {allowedRoles.includes('CLINIC_MANAGER') && (
                                <label
                                    className={`flex-1 min-h-[64px] flex items-center justify-center p-2 border-4 border-stone-900 cursor-pointer transition-all text-center font-bold uppercase text-[10px] sm:text-xs ${role === 'CLINIC_MANAGER'
                                        ? 'bg-amber-200 text-amber-900 shadow-[6px_6px_0_#000] -translate-x-1 -translate-y-1'
                                        : 'bg-amber-50 text-amber-700 shadow-none opacity-70 hover:opacity-100 hover:bg-amber-100'
                                        } ${disabledRoles.includes('CLINIC_MANAGER') ? 'opacity-20 cursor-not-allowed grayscale' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="role"
                                        value="CLINIC_MANAGER"
                                        checked={role === 'CLINIC_MANAGER'}
                                        onChange={() => setRole('CLINIC_MANAGER')}
                                        className="sr-only"
                                        disabled={isSubmitting || disabledRoles.includes('CLINIC_MANAGER')}
                                    />
                                    QUẢN LÝ PHÒNG KHÁM
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-2">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="flex-1 py-2 bg-white text-stone-900 border-4 border-stone-900 font-bold uppercase text-sm shadow-[4px_4px_0_#000] hover:bg-stone-50 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                        >
                            HỦY
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-2 bg-amber-600 text-white border-4 border-stone-900 font-bold uppercase text-sm shadow-[4px_4px_0_#000] hover:bg-amber-700 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? 'ĐANG THÊM...' : 'THÊM NHÂN VIÊN'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
