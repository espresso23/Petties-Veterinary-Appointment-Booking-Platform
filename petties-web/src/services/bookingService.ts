/**
 * Booking API Service
 */
import axios from './api/client';
import type { Booking, CreateBookingRequest, ConfirmBookingRequest, AvailableStaffResponse, StaffAvailabilityCheckResponse, ConfirmBookingWithOptionsRequest } from '../types/booking';
import type { BookingStatus } from '../types/booking';
import type { ClinicServiceResponse } from '../types/service';

// Spring Page response type
interface PageResponse<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
}

// Staff option for dropdown selection
export interface StaffOption {
    staffId: string;
    fullName: string;
    avatarUrl?: string;
    specialty: string;
    specialtyLabel: string;
    isSuggested: boolean;
    bookingCount: number;
    hasAvailableSlots: boolean;
    availableServiceItemIds: string[];
    unavailableReason?: string;
}

const BOOKING_API = '/bookings';

/**
 * Get bookings by clinic (for Manager)
 */
export const getBookingsByClinic = async (
    clinicId: string,
    status?: BookingStatus,
    type?: string,
    page: number = 0,
    size: number = 20
): Promise<PageResponse<Booking>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('size', size.toString());
    if (status) params.append('status', status);
    if (type) params.append('type', type);

    const response = await axios.get(`${BOOKING_API}/clinic/${clinicId}?${params.toString()}`);
    return response.data;
};

/**
 * Get bookings by staff (for Staff)
 */
export const getBookingsByStaff = async (
    staffId: string,
    status?: BookingStatus,
    page: number = 0,
    size: number = 20
): Promise<PageResponse<Booking>> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('size', size.toString());
    if (status) params.append('status', status);

    const url = `${BOOKING_API}/staff/${staffId}?${params.toString()}`;
    const response = await axios.get(url);
    return response.data;
};

/**
 * Get booking by ID
 */
export const getBookingById = async (bookingId: string): Promise<Booking> => {
    const response = await axios.get(`${BOOKING_API}/${bookingId}`);
    return response.data;
};

/**
 * Get booking by code
 */
export const getBookingByCode = async (bookingCode: string): Promise<Booking> => {
    const response = await axios.get(`${BOOKING_API}/code/${bookingCode}`);
    return response.data;
};

/**
 * Create a new booking (Pet owner)
 */
export const createBooking = async (request: CreateBookingRequest): Promise<Booking> => {
    const response = await axios.post(BOOKING_API, request);
    return response.data;
};

/**
 * Confirm booking and auto-assign staff (Manager)
 */
export const confirmBooking = async (
    bookingId: string,
    request?: ConfirmBookingRequest
): Promise<Booking> => {
    const response = await axios.patch(`${BOOKING_API}/${bookingId}/confirm`, request || {});
    return response.data;
};

/**
 * Check staff availability before confirming booking
 * Returns detailed availability for each service and alternative time slot suggestions
 */
export const checkStaffAvailability = async (
    bookingId: string
): Promise<StaffAvailabilityCheckResponse> => {
    const response = await axios.get(`${BOOKING_API}/${bookingId}/check-staff-availability`);
    return response.data;
};

/**
 * Confirm booking with options (Manager)
 * Supports allowPartial and removeUnavailableServices flags
 */
export const confirmBookingWithOptions = async (
    bookingId: string,
    request: ConfirmBookingWithOptionsRequest
): Promise<Booking> => {
    const response = await axios.patch(`${BOOKING_API}/${bookingId}/confirm`, request);
    return response.data;
};

/**
 * Cancel booking
 */
export const cancelBooking = async (bookingId: string, reason: string): Promise<Booking> => {
    const response = await axios.patch(`${BOOKING_API}/${bookingId}/cancel`, null, {
        params: { reason }
    });
    return response.data;
};

/**
 * Get available staff for reassigning a specific service
 */
export const getAvailableStaffForReassign = async (
    bookingId: string,
    serviceId: string
): Promise<AvailableStaffResponse[]> => {
    const response = await axios.get(`${BOOKING_API}/${bookingId}/services/${serviceId}/available-staff`);
    return response.data;
};

/**
 * Reassign staff for a specific service in a booking
 */
export const reassignStaffForService = async (
    bookingId: string,
    serviceId: string,
    newStaffId: string
): Promise<Booking> => {
    const response = await axios.post(`${BOOKING_API}/${bookingId}/services/${serviceId}/reassign`, {
        newStaffId
    });
    return response.data;
};

/**
 * Add a service to an active booking (IN_PROGRESS or ARRIVED)
 * Used when staff wants to add extra services during home visit
 * Distance fee is NOT recalculated
 */
export const addServiceToBooking = async (
    bookingId: string,
    serviceId: string
): Promise<Booking> => {
    const response = await axios.post(`${BOOKING_API}/${bookingId}/add-service`, {
        serviceId
    });
    return response.data;
};

/**
 * Get available services that can be added to this booking
 * Filters by specialty for Home Visit Staff
 */
export const getAvailableServicesForAddOn = async (
    bookingId: string
): Promise<ClinicServiceResponse[]> => {
    const response = await axios.get(`${BOOKING_API}/${bookingId}/available-services`);
    return response.data;
};

/**
 * Get available staff for confirming booking (dropdown selection)
 * Returns list of staff matching service specialty with availability status
 */
export const getAvailableStaffForConfirm = async (
    bookingId: string
): Promise<StaffOption[]> => {
    const response = await axios.get(`${BOOKING_API}/${bookingId}/available-staff-for-confirm`);
    return response.data;
};

/**
 * Check-in booking (Staff or Manager)
 * Transitions: CONFIRMED → IN_PROGRESS
 */
export const checkInBooking = async (bookingId: string): Promise<Booking> => {
    const response = await axios.post(`${BOOKING_API}/${bookingId}/check-in`);
    return response.data;
};

/**
 * Complete booking (Checkout)
 * Transitions: IN_PROGRESS → COMPLETED
 */
export const completeBooking = async (bookingId: string): Promise<Booking> => {
    const response = await axios.post(`${BOOKING_API}/${bookingId}/complete`);
    return response.data;
};

/**
 * Remove an add-on service from booking
 */
export const removeServiceFromBooking = async (
    bookingId: string,
    serviceId: string
): Promise<Booking> => {
    const response = await axios.delete(`${BOOKING_API}/${bookingId}/services/${serviceId}`);
    return response.data;
};

// ========== SHARED VISIBILITY ==========

/**
 * Clinic Today Booking Response - extends Booking with isMyAssignment flag
 */
export interface ClinicTodayBooking extends Booking {
    isMyAssignment: boolean;
}

/**
 * Get all bookings for a clinic today - Shared Visibility for Staff
 * All staff in the clinic can see ALL bookings, with isMyAssignment flag
 * to identify their own assignments.
 *
 * @param clinicId Clinic ID
 * @returns List of ClinicTodayBooking with isMyAssignment flag
 */
export const getClinicTodayBookings = async (
    clinicId: string
): Promise<ClinicTodayBooking[]> => {
    const response = await axios.get(`${BOOKING_API}/clinic/${clinicId}/today`);
    return response.data;
};

