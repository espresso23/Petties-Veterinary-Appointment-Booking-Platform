-- Migration: Add PET_OWNER_STRIKE to notifications_type_check
-- Date: 2026-03-18

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check CHECK (
    type::text = ANY(ARRAY[
        'APPROVED',
        'REJECTED',
        'PENDING',
        'CLINIC_PENDING_APPROVAL',
        'CLINIC_VERIFIED',
        'CLINIC_STRIKE',
        'PET_OWNER_STRIKE',
        'STAFF_SHIFT_ASSIGNED',
        'STAFF_SHIFT_UPDATED',
        'STAFF_SHIFT_DELETED',
        'STAFF_ON_WAY',
        'STAFF_ARRIVED',
        'BOOKING_CREATED',
        'BOOKING_CONFIRMED',
        'BOOKING_ASSIGNED',
        'BOOKING_CANCELLED',
        'BOOKING_CHECKIN',
        'BOOKING_PAYMENT_REQUIRED',
        'BOOKING_COMPLETED',
        'BOOKING_REMINDER',
        'RE_EXAMINATION_REMINDER',
        'VACCINATION_REMINDER',
        'REPORT_CREATED',
        'REPORT_RESOLVED',
        'SYSTEM',
        'PROMOTION',
        'REFUND_REQUESTED',
        'REFUND_APPROVED',
        'REFUND_REJECTED'
    ])
);
