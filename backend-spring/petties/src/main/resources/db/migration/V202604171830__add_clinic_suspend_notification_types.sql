-- Migration: Add clinic suspend notification types to notifications_type_check
-- Date: 2026-04-17 18:30

BEGIN;

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
        'CLINIC_SUSPEND_REQUEST',
        'CLINIC_SUSPEND_APPROVED',
        'CLINIC_SUSPEND_REJECTED',
        'CLINIC_ACTIVATED',
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
        'REFUND_REQUESTED',
        'REFUND_APPROVED',
        'REFUND_REJECTED',
        'RE_EXAMINATION_REMINDER',
        'VACCINATION_REMINDER',
        'SYSTEM_MONEY',
        'SYSTEM_SERVER',
        'SYSTEM_WORK',
        'SYSTEM_TIME',
        'SYSTEM_OTHER',
        'SUBSCRIPTION_EXPIRING_SOON',
        'SUBSCRIPTION_ACTIVATED',
        'REPORT_CREATED',
        'REPORT_RESOLVED'
    ])
);

COMMIT;