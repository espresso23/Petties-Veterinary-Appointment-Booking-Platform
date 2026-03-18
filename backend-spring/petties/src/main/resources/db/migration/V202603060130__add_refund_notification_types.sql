-- Migration: Add REFUND notification types to notifications_type_check
-- Date: 2026-03-06 01:30
-- Adds REFUND_REQUESTED, REFUND_APPROVED, REFUND_REJECTED types so that
-- withdrawal request notifications can be saved to the DB.

BEGIN;

-- Drop existing check constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Re-create check constraint including REFUND types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check CHECK (
    type::text = ANY(ARRAY[
        'APPROVED',
        'REJECTED',
        'PENDING',
        'CLINIC_PENDING_APPROVAL',
        'CLINIC_VERIFIED',
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
        'BOOKING_COMPLETED',
        'BOOKING_REMINDER',
        'RE_EXAMINATION_REMINDER',
        'VACCINATION_REMINDER',
        'SYSTEM',
        'PROMOTION',
        'REFUND_REQUESTED',
        'REFUND_APPROVED',
        'REFUND_REJECTED'
    ])
);

COMMIT;
