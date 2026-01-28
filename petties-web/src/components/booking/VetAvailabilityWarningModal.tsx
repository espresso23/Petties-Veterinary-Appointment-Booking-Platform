import React, { useState } from 'react';
import {
    XMarkIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    CalendarDaysIcon,
    ClockIcon,
} from '@heroicons/react/24/solid';
import type { VetAvailabilityCheckResponse } from '../../types/booking';
import { STAFF_SPECIALTY_LABELS } from '../../types/booking';

export type ConfirmOption = 'partial' | 'remove' | 'cancel';

interface VetAvailabilityWarningModalProps {
    isOpen: boolean;
    availability: VetAvailabilityCheckResponse;
    onClose: () => void;
    onConfirm: (option: ConfirmOption) => void;
    isConfirming: boolean;
}

// Format price to Vietnamese currency
const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        minimumFractionDigits: 0,
    }).format(price);
};

// Format date to Vietnamese format
const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

export const VetAvailabilityWarningModal: React.FC<VetAvailabilityWarningModalProps> = ({
    isOpen,
    availability,
    onClose,
    onConfirm,
    isConfirming,
}) => {
    const [selectedOption, setSelectedOption] = useState<ConfirmOption | null>(null);

    if (!isOpen) return null;

    const unavailableServices = availability.services.filter((s) => !s.hasAvailableVet);
    const availableServices = availability.services.filter((s) => s.hasAvailableVet);

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-stone-900/50">
            <div className="w-full max-w-2xl bg-white border-4 border-stone-900 shadow-brutal max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-stone-900 bg-amber-100">
                    <div className="flex items-center gap-3">
                        <ExclamationTriangleIcon className="w-8 h-8 text-amber-600" />
                        <div>
                            <h2 className="font-bold text-lg">Cảnh báo thiếu bác sĩ</h2>
                            <p className="text-sm text-stone-600">
                                {unavailableServices.length} dịch vụ chưa có bác sĩ phù hợp
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center bg-stone-900 text-white font-bold hover:bg-stone-700"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Service availability list */}
                    <div className="space-y-2">
                        <p className="text-sm font-bold uppercase text-stone-500">Trạng thái dịch vụ</p>
                        {availability.services.map((service) => (
                            <div
                                key={service.bookingServiceId}
                                className={`p-3 border-2 border-stone-900 flex items-center justify-between ${
                                    service.hasAvailableVet ? 'bg-green-50' : 'bg-red-50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {service.hasAvailableVet ? (
                                        <CheckCircleIcon className="w-6 h-6 text-green-600" />
                                    ) : (
                                        <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
                                    )}
                                    <div>
                                        <p className="font-bold">{service.serviceName}</p>
                                        <p className="text-xs text-stone-500">
                                            {service.requiredSpecialtyLabel ||
                                                STAFF_SPECIALTY_LABELS[service.requiredSpecialty] ||
                                                service.requiredSpecialty}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold">{formatPrice(service.price)}</p>
                                    {service.hasAvailableVet ? (
                                        <p className="text-xs text-green-700">
                                            {service.suggestedVetName}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-red-700">
                                            {service.unavailableReason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Alternative time slots */}
                    {availability.alternativeTimeSlots.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-sm font-bold uppercase text-stone-500 flex items-center gap-2">
                                <CalendarDaysIcon className="w-4 h-4" />
                                Gợi ý khung giờ có bác sĩ
                            </p>
                            <div className="space-y-2">
                                {availability.alternativeTimeSlots.map((slot, index) => (
                                    <div
                                        key={index}
                                        className="p-3 border-2 border-stone-900 bg-blue-50"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm">
                                                    {slot.specialtyLabel ||
                                                        STAFF_SPECIALTY_LABELS[slot.specialty] ||
                                                        slot.specialty}
                                                </p>
                                                <p className="text-xs text-stone-600">
                                                    {slot.vetName}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold">
                                                    {formatDate(slot.date)}
                                                </p>
                                                <div className="flex items-center gap-1 text-xs text-stone-600">
                                                    <ClockIcon className="w-3 h-3" />
                                                    {slot.availableTimes.slice(0, 4).join(', ')}
                                                    {slot.availableTimes.length > 4 && '...'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Options */}
                    <div className="space-y-2">
                        <p className="text-sm font-bold uppercase text-stone-500">
                            Chọn cách xử lý
                        </p>

                        {/* Option A: Partial Confirm */}
                        <label
                            className={`block p-4 border-2 border-stone-900 cursor-pointer transition-all ${
                                selectedOption === 'partial'
                                    ? 'bg-amber-100 shadow-[4px_4px_0_#1c1917]'
                                    : 'bg-white hover:bg-stone-50'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <input
                                    type="radio"
                                    name="confirmOption"
                                    value="partial"
                                    checked={selectedOption === 'partial'}
                                    onChange={() => setSelectedOption('partial')}
                                    className="mt-1 w-4 h-4"
                                />
                                <div>
                                    <p className="font-bold">Xác nhận một phần</p>
                                    <p className="text-sm text-stone-600">
                                        Xác nhận booking và gán bác sĩ thủ công cho các dịch vụ
                                        thiếu sau. Booking sẽ ở trạng thái "Đã xác nhận" thay
                                        vì "Đã gán BS".
                                    </p>
                                </div>
                            </div>
                        </label>

                        {/* Option B: Remove unavailable */}
                        <label
                            className={`block p-4 border-2 border-stone-900 cursor-pointer transition-all ${
                                selectedOption === 'remove'
                                    ? 'bg-amber-100 shadow-[4px_4px_0_#1c1917]'
                                    : 'bg-white hover:bg-stone-50'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <input
                                    type="radio"
                                    name="confirmOption"
                                    value="remove"
                                    checked={selectedOption === 'remove'}
                                    onChange={() => setSelectedOption('remove')}
                                    className="mt-1 w-4 h-4"
                                />
                                <div>
                                    <p className="font-bold">
                                        Loại bỏ dịch vụ thiếu bác sĩ
                                        <span className="ml-2 text-red-600 font-normal">
                                            (giảm {formatPrice(availability.priceReductionIfRemoved)})
                                        </span>
                                    </p>
                                    <p className="text-sm text-stone-600">
                                        Xóa {unavailableServices.length} dịch vụ không có bác sĩ
                                        và tính lại giá. Chỉ giữ lại {availableServices.length} dịch
                                        vụ có bác sĩ.
                                    </p>
                                </div>
                            </div>
                        </label>

                        {/* Option C: Cancel */}
                        <label
                            className={`block p-4 border-2 border-stone-900 cursor-pointer transition-all ${
                                selectedOption === 'cancel'
                                    ? 'bg-amber-100 shadow-[4px_4px_0_#1c1917]'
                                    : 'bg-white hover:bg-stone-50'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <input
                                    type="radio"
                                    name="confirmOption"
                                    value="cancel"
                                    checked={selectedOption === 'cancel'}
                                    onChange={() => setSelectedOption('cancel')}
                                    className="mt-1 w-4 h-4"
                                />
                                <div>
                                    <p className="font-bold">Hủy để thêm lịch bác sĩ trước</p>
                                    <p className="text-sm text-stone-600">
                                        Đóng modal và thêm ca làm việc cho bác sĩ trước, sau đó
                                        quay lại xác nhận booking.
                                    </p>
                                </div>
                            </div>
                        </label>
                    </div>
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
                        onClick={() => selectedOption && onConfirm(selectedOption)}
                        disabled={!selectedOption || isConfirming}
                        className={`flex-1 py-3 px-4 font-bold border-2 border-stone-900 shadow-[3px_3px_0_#1c1917] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#1c1917] transition-all ${
                            selectedOption && !isConfirming
                                ? 'bg-amber-500 text-stone-900'
                                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                        }`}
                    >
                        {isConfirming ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN CHỌN LỰA'}
                    </button>
                </div>
            </div>
        </div>
    );
};
