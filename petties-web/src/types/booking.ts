/**
 * Booking Types - Frontend type definitions
 */

// Booking Status enum
export type BookingStatus = 'PENDING' | 'SEARCHING' | 'PENDING_CLINIC_CONFIRM' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

// Booking Type enum
export type BookingType = 'IN_CLINIC' | 'HOME_VISIT' | 'SOS';

// Service item in booking
export interface BookingServiceItem {
    bookingServiceId?: string; // BookingServiceItem ID (junction table PK) - for reassignment
    serviceId: string;
    serviceName: string;
    serviceCategory: string;
    price: number;
    slotsRequired: number;
    durationMinutes: number;

    // Pricing breakdown fields
    basePrice?: number;      // Original service base price
    weightPrice?: number;    // Price tier based on pet weight

    // Assigned staff for this specific service
    assignedStaffId?: string;
    assignedStaffName?: string;
    assignedStaffAvatarUrl?: string;
    assignedStaffSpecialty?: string;

    // Scheduled time for this service
    scheduledStartTime?: string; // For display
    scheduledEndTime?: string;   // For display
    isAddOn?: boolean;           // Arising service

    // Pet this service is for (multi-pet booking)
    petId?: string;
    petName?: string;
}

// Main Booking interface
export interface Booking {
    bookingId: string;
    bookingCode: string;
    emrId?: string; // Linked EMR ID if exists

    // Pet info
    petId: string;
    petName: string;
    petSpecies: string;
    petBreed: string;
    petAge: string;
    petPhotoUrl?: string;
    petWeight?: number; // Weight in kg

    // Owner info
    ownerId: string;
    ownerName: string;
    ownerPhone: string;
    ownerEmail: string;
    ownerAvatarUrl?: string;
    ownerAddress?: string; // Pet owner's registered address

    // Clinic info
    clinicId: string;
    clinicName: string;
    clinicAddress?: string;

    // Staff info
    assignedStaffId?: string;
    assignedStaffName?: string;
    assignedStaffSpecialty?: string;
    assignedStaffAvatarUrl?: string;

    // Payment info
    paymentStatus?: string; // PENDING, PAID, REFUNDED, FAILED
    paymentMethod?: string; // CASH, QR, CARD
    paymentDescription?: string; // SePay payment description for QR matching
    qrImageUrl?: string; // QR code image URL (only for QR + PENDING)

    // Booking info
    bookingDate: string;
    bookingTime: string;
    type: BookingType;
    status: BookingStatus;
    totalPrice: number;
    notes?: string;
    services: BookingServiceItem[];

    /**
     * List of pets in booking (multi-pet), each with its own services.
     */
    pets?: PetInBookingSummary[];

    // Home visit info
    homeAddress?: string;
    homeLat?: number;
    homeLong?: number;
    distanceKm?: number;
    distanceFee?: number; // Home visit fee (pricePerKm × distanceKm) applied once
    sosFee?: number;      // SOS emergency fee

    // Timestamps
    createdAt: string;
}

/**
 * Summary of a pet in a booking (multi-pet) with its services.
 */
export interface PetInBookingSummary {
    petId: string;
    petName: string;
    services: BookingServiceItem[];
}

// Create booking request
export interface CreateBookingRequest {
    petId: string;
    clinicId: string;
    bookingDate: string;
    bookingTime: string;
    type: BookingType;
    serviceIds: string[];
    homeAddress?: string;
    homeLat?: number;
    homeLong?: number;
    notes?: string;
}

// Confirm booking request
export interface ConfirmBookingRequest {
    assignedStaffId?: string;
    selectedStaffId?: string; // For manual staff selection dropdown
    managerNotes?: string;
}

// Status badge colors - Petties Amber-Stone Theme
export const BOOKING_STATUS_CONFIG: Record<BookingStatus, { label: string; bgColor: string; textColor: string }> = {
    PENDING: { label: 'Chờ xác nhận', bgColor: '#F5F5F4', textColor: '#44403C' }, // stone-100 / stone-700
    SEARCHING: { label: 'Đang tìm kiếm', bgColor: '#FEF3C7', textColor: '#D97706' }, // amber-100 / amber-600
    PENDING_CLINIC_CONFIRM: { label: 'Chờ phòng khám', bgColor: '#FEF3C7', textColor: '#D97706' }, // amber-100 / amber-600
    CONFIRMED: { label: 'Đã xác nhận', bgColor: '#FFFBEB', textColor: '#B45309' }, // amber-50 / amber-700
    IN_PROGRESS: { label: 'Đang thực hiện', bgColor: '#FEF3C7', textColor: '#D97706' }, // amber-100 / amber-600 (primary)
    COMPLETED: { label: 'Hoàn thành', bgColor: '#DCFCE7', textColor: '#16A34A' }, // green-100 / green-600
    CANCELLED: { label: 'Đã hủy', bgColor: '#F5F5F4', textColor: '#57534E' }, // stone-100 / stone-600
    NO_SHOW: { label: 'Không đến', bgColor: '#F5F5F4', textColor: '#57534E' }, // stone-100 / stone-600
};

// Booking type config with colors
export const BOOKING_TYPE_CONFIG: Record<BookingType, { label: string; bgColor: string; textColor: string }> = {
    IN_CLINIC: { label: 'Tại phòng khám', bgColor: '#86EFAC', textColor: '#166534' },
    HOME_VISIT: { label: 'Khám tại nhà', bgColor: '#FDE68A', textColor: '#92400E' },
    SOS: { label: 'SOS cấp cứu', bgColor: '#FCA5A5', textColor: '#991B1B' },
};

// Booking type labels (backward compatibility)
export const BOOKING_TYPE_LABELS: Record<BookingType, string> = {
    IN_CLINIC: 'Tại phòng khám',
    HOME_VISIT: 'Khám tại nhà',
    SOS: 'SOS cấp cứu',
};

// Service category labels (Vietnamese)
export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
    CHECK_UP: 'Khám tổng quát',
    VACCINATION: 'Tiêm phòng',
    SURGERY: 'Phẫu thuật',
    DENTAL: 'Nha khoa',
    DERMATOLOGY: 'Da liễu',
    INTERNAL_MEDICINE: 'Nội khoa',
    EMERGENCY: 'Cấp cứu',
    GROOMING_SPA: 'Làm đẹp & Spa',
    BOARDING: 'Trông giữ',
    OTHER: 'Khác',
};

// Payment status labels
export const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Chờ thanh toán', color: '#FCD34D' },
    PAID: { label: 'Đã thanh toán', color: '#4ADE80' },
    REFUNDED: { label: 'Đã hoàn tiền', color: '#93C5FD' },
    FAILED: { label: 'Thất bại', color: '#FCA5A5' },
};

// Payment method labels
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
    CASH: 'Tiền mặt',
    QR: 'QR Code',
    CARD: 'Thẻ tín dụng',
};

// Staff Specialty labels (Vietnamese)
export const STAFF_SPECIALTY_LABELS: Record<string, string> = {
    VET: 'Bác sĩ thú y',
    GROOMER: 'Nhân viên Grooming',
    // Legacy (sau migration DB chỉ còn VET | GROOMER)
    VET_GENERAL: 'Bác sĩ thú y',
    VET_SURGERY: 'Bác sĩ thú y',
    VET_DENTAL: 'Bác sĩ thú y',
    VET_DERMATOLOGY: 'Bác sĩ thú y',
};

// Available staff response for reassignment
export interface AvailableStaffResponse {
    staffId: string;
    staffName: string;
    avatarUrl?: string;
    specialty?: string;
    available: boolean;
    bookedCount: number;
    availableSlots: string[]; // List of available slot times (HH:mm)
    unavailableReason?: string; // If not available, reason why
}

// Reassign staff request
export interface ReassignStaffRequest {
    newStaffId: string;
}

// ========== STAFF AVAILABILITY CHECK ==========

// Service availability in a booking
export interface ServiceAvailability {
    bookingServiceId: string;
    serviceName: string;
    serviceCategory: string;
    requiredSpecialty: string;
    requiredSpecialtyLabel: string;
    price: number;
    hasAvailableStaff: boolean;
    suggestedStaffId?: string;
    suggestedStaffName?: string;
    suggestedStaffAvatarUrl?: string;
    suggestedStaffSpecialty?: string;
    unavailableReason?: string;
}

// Alternative time slot suggestion
export interface AlternativeTimeSlot {
    specialty: string;
    specialtyLabel: string;
    date: string; // ISO date format
    availableTimes: string[]; // HH:mm format
    staffName: string;
    staffId: string;
}

// Staff availability check response
export interface StaffAvailabilityCheckResponse {
    allServicesHaveStaff: boolean;
    services: ServiceAvailability[];
    alternativeTimeSlots: AlternativeTimeSlot[];
    priceReductionIfRemoved: number;
}

// Confirm booking request with options
export interface ConfirmBookingWithOptionsRequest {
    assignedStaffId?: string;
    managerNotes?: string;
    allowPartial?: boolean;
    removeUnavailableServices?: boolean;
}
