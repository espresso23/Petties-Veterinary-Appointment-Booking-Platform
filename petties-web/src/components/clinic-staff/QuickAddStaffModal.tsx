import { useState } from 'react'
import { XMarkIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import type { InviteByEmailRequest, StaffRole, StaffSpecialty } from '../../types/clinicStaff'
import { SPECIALTY_LABELS } from '../../types/clinicStaff'

interface AddStaffModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: InviteByEmailRequest) => Promise<void>
    allowedRoles?: StaffRole[]
    disabledRoles?: StaffRole[]
    title?: string
}

/**
 * Add Staff Modal - Email Only (Neobrutalism Design)
 * Staff will login with Google OAuth
 * FullName and Avatar auto-filled from Google profile
 */
export function QuickAddStaffModal({
    isOpen,
    onClose,
    onSubmit,
    allowedRoles = ['VET', 'CLINIC_MANAGER'],
    disabledRoles = [],
    title = 'THÊM NHÂN VIÊN MỚI',
}: AddStaffModalProps) {
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<StaffRole>(allowedRoles[0])
    const [specialty, setSpecialty] = useState<StaffSpecialty>('VET_GENERAL')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        // Email validation
        if (!email.trim()) {
            setError('Vui lòng nhập email')
            return
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            setError('Email không hợp lệ')
            return
        }

        setIsSubmitting(true)
        try {
            await onSubmit({
                email: email.trim(),
                role,
                specialty: role === 'VET' ? specialty : undefined
            })
            // Reset form
            resetForm()
            onClose()
        } catch (err: any) {
            setError(err?.userMessage || err?.message || 'Có lỗi xảy ra')
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setEmail('')
        setRole(allowedRoles[0])
        setSpecialty('VET_GENERAL')
        setError(null)
    }

    const handleClose = () => {
        if (!isSubmitting) {
            resetForm()
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

                    {/* Info Banner */}
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border-2 border-blue-300">
                        <EnvelopeIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
                        <p className="text-xs text-blue-800">
                            Nhân viên sẽ đăng nhập bằng Google. Tên và ảnh sẽ tự động lấy từ tài khoản Google.
                        </p>
                    </div>

                    {/* Email Input */}
                    <div>
                        <label className="block text-sm font-bold uppercase text-stone-700 mb-2">
                            EMAIL
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="bacsi@gmail.com"
                            className="input-brutal"
                            disabled={isSubmitting}
                        />
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

                    {/* Specialty - Only show when role is VET */}
                    {role === 'VET' && (
                        <div>
                            <label className="block text-sm font-bold uppercase text-stone-700 mb-2">
                                CHUYÊN MÔN
                            </label>
                            <select
                                value={specialty}
                                onChange={(e) => setSpecialty(e.target.value as StaffSpecialty)}
                                className="input-brutal"
                                disabled={isSubmitting}
                            >
                                {(Object.keys(SPECIALTY_LABELS) as StaffSpecialty[]).map((key) => (
                                    <option key={key} value={key}>
                                        {SPECIALTY_LABELS[key]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

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
