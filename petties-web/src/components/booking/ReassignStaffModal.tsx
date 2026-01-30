import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import type { AvailableStaffResponse, BookingServiceItem } from '../../types/booking';
import { STAFF_SPECIALTY_LABELS } from '../../types/booking';
import { getAvailableStaffForReassign, reassignStaffForService } from '../../services/bookingService';
import { useToast } from '../Toast';

interface ReassignStaffModalProps {
    isOpen: boolean;
    bookingId: string;
    service: BookingServiceItem;
    onClose: () => void;
    onReassigned: () => void;
}

export const ReassignStaffModal: React.FC<ReassignStaffModalProps> = ({
    isOpen,
    bookingId,
    service,
    onClose,
    onReassigned,
}) => {
    const { showToast } = useToast();
    const [availableStaff, setAvailableStaff] = useState<AvailableStaffResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [reassigning, setReassigning] = useState(false);
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && bookingId && service.bookingServiceId) {
            fetchAvailableStaff();
        }
    }, [isOpen, bookingId, service.bookingServiceId]);

    const fetchAvailableStaff = async () => {
        if (!service.bookingServiceId) {
            showToast('error', 'Không tìm thấy ID dịch vụ');
            return;
        }
        setLoading(true);
        try {
            const staff = await getAvailableStaffForReassign(bookingId, service.bookingServiceId);
            setAvailableStaff(staff);
        } catch (error) {
            console.error('Failed to fetch available staff:', error);
            showToast('error', 'Không thể tải danh sách nhân viên');
        } finally {
            setLoading(false);
        }
    };

    const handleReassign = async () => {
        if (!selectedStaffId) {
            showToast('error', 'Vui lòng chọn nhân viên');
            return;
        }
        if (!service.bookingServiceId) {
            showToast('error', 'Không tìm thấy ID dịch vụ');
            return;
        }

        setReassigning(true);
        try {
            await reassignStaffForService(bookingId, service.bookingServiceId, selectedStaffId);
            showToast('success', 'Đã đổi nhân viên thành công');
            onReassigned();
            onClose();
        } catch (error) {
            console.error('Failed to reassign staff:', error);
            showToast('error', 'Không thể đổi nhân viên. Vui lòng thử lại.');
        } finally {
            setReassigning(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stone-900/50">
            <div className="w-full max-w-lg bg-white border-4 border-stone-900 shadow-brutal">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-stone-900 bg-blue-100">
                    <div>
                        <h2 className="font-bold text-lg">Đổi nhân viên phụ trách</h2>
                        <p className="text-sm text-stone-600">
                            Dịch vụ: <span className="font-bold">{service.serviceName}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center bg-stone-900 text-white font-bold hover:bg-stone-700"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-8 text-stone-500">
                            Đang tải danh sách nhân viên...
                        </div>
                    ) : availableStaff.length === 0 ? (
                        <div className="text-center py-8 text-stone-500">
                            Không tìm thấy nhân viên phù hợp
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {availableStaff.map((staff) => (
                                <div
                                    key={staff.staffId}
                                    onClick={() => staff.available && setSelectedStaffId(staff.staffId)}
                                    className={`p-4 border-2 border-stone-900 cursor-pointer transition-all
                                        ${staff.available
                                            ? selectedStaffId === staff.staffId
                                                ? 'bg-green-100 shadow-[4px_4px_0_#1c1917]'
                                                : 'bg-white hover:bg-stone-50'
                                            : 'bg-stone-100 opacity-60 cursor-not-allowed'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Avatar */}
                                        <div className="w-12 h-12 border-2 border-stone-900 rounded-lg overflow-hidden bg-stone-200 flex-shrink-0">
                                            {staff.avatarUrl ? (
                                                <img
                                                    src={staff.avatarUrl}
                                                    alt={staff.staffName}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-bold text-lg">
                                                    {staff.staffName.charAt(0)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">{staff.staffName}</span>
                                                {staff.available ? (
                                                    <span className="px-2 py-0.5 text-xs font-bold bg-green-200 text-green-800 border border-green-400">
                                                        Sẵn sàng
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 text-xs font-bold bg-red-200 text-red-800 border border-red-400">
                                                        Bận
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-stone-600">
                                                {staff.specialty ? STAFF_SPECIALTY_LABELS[staff.specialty] || staff.specialty : 'Chưa xác định'}
                                            </div>
                                            {staff.available && staff.availableSlots.length > 0 && (
                                                <div className="text-xs text-stone-500 mt-1">
                                                    Slot trống: {staff.availableSlots.slice(0, 5).join(', ')}
                                                    {staff.availableSlots.length > 5 && '...'}
                                                </div>
                                            )}
                                            {!staff.available && staff.unavailableReason && (
                                                <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                                    <ExclamationTriangleIcon className="w-3 h-3" />
                                                    {staff.unavailableReason}
                                                </div>
                                            )}
                                        </div>

                                        {/* Selection indicator */}
                                        {selectedStaffId === staff.staffId && (
                                            <div className="w-8 h-8 bg-green-500 border-2 border-stone-900 flex items-center justify-center">
                                                <CheckIcon className="w-5 h-5 text-white" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-4 border-t-4 border-stone-900 bg-stone-50">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-4 bg-white text-stone-900 border-2 border-stone-900 font-bold shadow-[3px_3px_0_#1c1917] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#1c1917] transition-all"
                    >
                        HỦY
                    </button>
                    <button
                        onClick={handleReassign}
                        disabled={!selectedStaffId || reassigning}
                        className={`flex-1 py-3 px-4 font-bold border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#1c1917] transition-all
                            ${selectedStaffId && !reassigning
                                ? 'bg-amber-500 text-stone-900'
                                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                            }
                        `}
                    >
                        {reassigning ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN ĐỔI'}
                    </button>
                </div>
            </div>
        </div>
    );
};
