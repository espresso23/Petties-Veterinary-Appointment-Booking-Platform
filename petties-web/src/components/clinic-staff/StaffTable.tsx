import { useState } from 'react'
import { TrashIcon, UserCircleIcon, PencilIcon } from '@heroicons/react/24/outline'
import type { StaffMember, StaffSpecialty } from '../../types/clinicStaff'
import { SPECIALTY_LABELS } from '../../types/clinicStaff'
import { ConfirmDialog } from '../common/ConfirmDialog'

interface StaffTableProps {
    staff: StaffMember[]
    isLoading?: boolean
    onRemove?: (userId: string) => void
    onEditSpecialty?: (member: StaffMember) => void
    canRemove?: boolean
    canEdit?: boolean
}

/**
 * Staff Table Component - Neobrutalism Design
 * Displays staff members in a table with actions
 */
export function StaffTable({ staff, isLoading, onRemove, onEditSpecialty, canRemove = true, canEdit = true }: StaffTableProps) {
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean
        userId: string
        fullName: string
    }>({ isOpen: false, userId: '', fullName: '' })

    const handleRemoveClick = (userId: string, fullName: string) => {
        setConfirmDialog({ isOpen: true, userId, fullName })
    }

    const handleConfirmRemove = async () => {
        if (!onRemove) return

        const { userId } = confirmDialog
        setConfirmDialog({ isOpen: false, userId: '', fullName: '' })
        setRemovingId(userId)
        try {
            await onRemove(userId)
        } finally {
            setRemovingId(null)
        }
    }

    const handleCancelRemove = () => {
        setConfirmDialog({ isOpen: false, userId: '', fullName: '' })
    }

    const getRoleBadge = (role: string) => {
        if (role === 'VET') {
            return (
                <span className="px-3 py-1 bg-green-100 text-green-800 border-2 border-stone-900 font-bold text-xs uppercase shadow-[2px_2px_0_#1c1917]">
                    BÁC SĨ THÚ Y
                </span>
            )
        }
        return (
            <span className="px-3 py-1 bg-amber-100 text-amber-800 border-2 border-stone-900 font-bold text-xs uppercase shadow-[2px_2px_0_#1c1917]">
                QUẢN LÝ PHÒNG KHÁM
            </span>
        )
    }

    const getSpecialtyBadge = (specialty?: StaffSpecialty) => {
        if (!specialty) return <span className="text-stone-400">-</span>

        const label = SPECIALTY_LABELS[specialty] || specialty

        // Neobrutalism colors - matching app design
        const colorClasses: Record<StaffSpecialty, string> = {
            VET_GENERAL: 'bg-blue-100 text-blue-800',
            VET_SURGERY: 'bg-purple-100 text-purple-800',
            VET_DENTAL: 'bg-cyan-100 text-cyan-800',
            VET_DERMATOLOGY: 'bg-pink-100 text-pink-800',
            GROOMER: 'bg-orange-100 text-orange-800',
        }

        return (
            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border-2 border-stone-900 shadow-[2px_2px_0_#1c1917] ${colorClasses[specialty]}`}>
                {label}
            </span>
        )
    }

    if (isLoading) {
        return (
            <div className="card-brutal p-8">
                <div className="flex items-center justify-center">
                    <div className="text-stone-600 font-bold uppercase">Đang tải...</div>
                </div>
            </div>
        )
    }

    if (staff.length === 0) {
        return (
            <div className="card-brutal p-12 text-center">
                <UserCircleIcon className="w-16 h-16 mx-auto text-stone-400 mb-4" />
                <p className="text-stone-600 font-bold uppercase text-lg mb-2">
                    CHƯA CÓ NHÂN VIÊN
                </p>
                <p className="text-stone-500 text-sm">
                    Thêm nhân viên để bắt đầu quản lý đội ngũ
                </p>
            </div>
        )
    }

    return (
        <>
            <div className="card-brutal overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-stone-100 border-b-4 border-stone-900">
                            <tr>
                                <th className="text-left p-4 font-bold uppercase text-sm text-stone-900">
                                    NHÂN VIÊN
                                </th>
                                <th className="text-left p-4 font-bold uppercase text-sm text-stone-900">
                                    SỐ ĐIỆN THOẠI
                                </th>
                                <th className="text-left p-4 font-bold uppercase text-sm text-stone-900">
                                    VAI TRÒ
                                </th>
                                <th className="text-left p-4 font-bold uppercase text-sm text-stone-900">
                                    CHUYÊN MÔN
                                </th>
                                {(canRemove || canEdit) && (
                                    <th className="text-right p-4 font-bold uppercase text-sm text-stone-900">
                                        HÀNH ĐỘNG
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map((member, index) => (
                                <tr
                                    key={member.userId}
                                    className={`border-b-2 border-stone-200 hover:bg-amber-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-stone-50'
                                        }`}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.fullName}
                                                    className="w-10 h-10 border-2 border-stone-900 object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 bg-amber-100 border-2 border-stone-900 flex items-center justify-center">
                                                    <span className="text-amber-800 font-bold text-sm">
                                                        {member.fullName?.charAt(0)?.toUpperCase() || '?'}
                                                    </span>
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-stone-900">
                                                    {member.fullName || member.email || member.username}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-stone-500">@{member.username}</span>
                                                    {!member.fullName && (
                                                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-300">
                                                            Chờ đăng nhập
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-stone-700 font-medium">
                                            {member.phone || '-'}
                                        </span>
                                    </td>
                                    <td className="p-4">{getRoleBadge(member.role)}</td>
                                    <td className="p-4">
                                        <span className="text-stone-700 font-medium text-sm">
                                            {member.role === 'VET' ? getSpecialtyBadge(member.specialty) : '-'}
                                        </span>
                                    </td>
                                    {(canRemove || canEdit) && (
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {canEdit && member.role === 'VET' && onEditSpecialty && (
                                                    <button
                                                        onClick={() => onEditSpecialty(member)}
                                                        className="p-2 text-amber-600 hover:bg-amber-100 border-2 border-transparent hover:border-amber-600 transition-all"
                                                        title="Sửa chuyên môn"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {canRemove && (
                                                    <button
                                                        onClick={() => handleRemoveClick(member.userId, member.fullName)}
                                                        disabled={removingId === member.userId}
                                                        className="p-2 text-red-600 hover:bg-red-100 border-2 border-transparent hover:border-red-600 transition-all disabled:opacity-50"
                                                        title="Xóa nhân viên"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y-4 divide-stone-900">
                    {staff.map((member) => (
                        <div key={member.userId} className="p-4 bg-white">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    {member.avatar ? (
                                        <img
                                            src={member.avatar}
                                            alt={member.fullName}
                                            className="w-12 h-12 border-2 border-stone-900 object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 bg-amber-100 border-2 border-stone-900 flex items-center justify-center">
                                            <span className="text-amber-800 font-bold">
                                                {member.fullName?.charAt(0)?.toUpperCase() || '?'}
                                            </span>
                                        </div>
                                    )}
                                    <div>
                                        <p className="font-bold text-stone-900">
                                            {member.fullName || member.email || member.username}
                                        </p>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs text-stone-500">@{member.username}</span>
                                            {!member.fullName && (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-300">
                                                    Chờ đăng nhập
                                                </span>
                                            )}
                                        </div>
                                        {getRoleBadge(member.role)}
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    {canEdit && member.role === 'VET' && onEditSpecialty && (
                                        <button
                                            onClick={() => onEditSpecialty(member)}
                                            className="p-2 text-amber-600 hover:bg-amber-100 border-2 border-amber-600"
                                        >
                                            <PencilIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                    {canRemove && (
                                        <button
                                            onClick={() => handleRemoveClick(member.userId, member.fullName)}
                                            disabled={removingId === member.userId}
                                            className="p-2 text-red-600 hover:bg-red-100 border-2 border-red-600"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="mt-3 text-sm text-stone-600 space-y-1">
                                {member.phone && <p>SĐT: {member.phone}</p>}
                                {member.role === 'VET' && (
                                    <p>Chuyên môn: {getSpecialtyBadge(member.specialty)}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={handleCancelRemove}
                onConfirm={handleConfirmRemove}
                title="Xóa nhân viên"
                message={`Bạn có chắc muốn xóa "${confirmDialog.fullName}" khỏi phòng khám?`}
                confirmText="Xóa nhân viên"
                cancelText="Hủy bỏ"
                variant="danger"
            />
        </>
    )
}

