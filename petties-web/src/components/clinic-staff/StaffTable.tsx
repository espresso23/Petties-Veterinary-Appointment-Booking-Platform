import { useState } from 'react'
import { TrashIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import type { StaffMember } from '../../types/clinicStaff'
import { ConfirmDialog } from '../common/ConfirmDialog'

interface StaffTableProps {
    staff: StaffMember[]
    isLoading?: boolean
    onRemove?: (userId: string) => void
    canRemove?: boolean
}

/**
 * Staff Table Component - Neobrutalism Design
 * Displays staff members in a table with actions
 */
export function StaffTable({ staff, isLoading, onRemove, canRemove = true }: StaffTableProps) {
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
                                    LIÊN HỆ
                                </th>
                                {canRemove && (
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
                                                <p className="font-bold text-stone-900">{member.fullName}</p>
                                                <p className="text-xs text-stone-500">@{member.username}</p>
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
                                        <div className="text-sm">
                                            <p className="text-stone-700 font-medium">{member.email || '-'}</p>
                                        </div>
                                    </td>
                                    {canRemove && (
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleRemoveClick(member.userId, member.fullName)}
                                                disabled={removingId === member.userId}
                                                className="p-2 text-red-600 hover:bg-red-100 border-2 border-transparent hover:border-red-600 transition-all disabled:opacity-50"
                                                title="Xóa nhân viên"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
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
                                        <p className="font-bold text-stone-900">{member.fullName}</p>
                                        <p className="text-xs text-stone-500 mb-1">@{member.username}</p>
                                        {getRoleBadge(member.role)}
                                    </div>
                                </div>
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
                            <div className="mt-3 text-sm text-stone-600 space-y-1">
                                {member.phone && <p>SĐT: {member.phone}</p>}
                                {member.email && <p>Email: {member.email}</p>}
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
