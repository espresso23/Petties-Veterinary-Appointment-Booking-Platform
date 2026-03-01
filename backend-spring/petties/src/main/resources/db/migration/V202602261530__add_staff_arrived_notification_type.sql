-- Migration: Add STAFF_ARRIVED notification type to notifications_type_check
-- Date: 2026-02-26 15:30
-- Rule: V<Timestamp>__<description>.sql
-- This ensures database constraint is aligned with NotificationType enum

BEGIN;

-- Drop existing check constraint if exists
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Re-create check constraint including STAFF_ARRIVED
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
        'PROMOTION'
    ])
);

COMMIT;

