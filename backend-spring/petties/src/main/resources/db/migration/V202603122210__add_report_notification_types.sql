-- Migration: Add REPORT_CREATED, REPORT_RESOLVED to notifications_type_check
-- Date: 2026-03-12 22:10
-- Rule: V<Timestamp>__<description>.sql
-- Fix: DataIntegrityViolationException when creating report (REPORT_CREATED not in constraint)

BEGIN;

-- Drop existing check constraint if exists
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Re-create check constraint including REPORT_CREATED, REPORT_RESOLVED
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
        'REPORT_CREATED',
        'REPORT_RESOLVED',
        'SYSTEM',
        'PROMOTION'
    ])
);

COMMIT;
