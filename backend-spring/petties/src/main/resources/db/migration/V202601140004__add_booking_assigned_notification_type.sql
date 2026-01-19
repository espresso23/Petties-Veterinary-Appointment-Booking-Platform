-- Add BOOKING_ASSIGNED to notifications type check constraint
-- V202601140004__add_booking_assigned_notification_type.sql

-- Drop existing constraint if exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check') THEN
        ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
    END IF;
END $$;

-- Add new constraint with all existing + new types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
    type::text = ANY(ARRAY[
        'BOOKING_CREATED',
        'BOOKING_CONFIRMED', 
        'BOOKING_CANCELLED',
        'BOOKING_REMINDER',
        'BOOKING_ASSIGNED',
        'SYSTEM',
        'PROMOTION',
        'VET_SHIFT_CREATED',
        'VET_SHIFT_UPDATED',
        'VET_SHIFT_DELETED',
        'VET_SHIFT_ASSIGNED',
        'CLINIC_PENDING_APPROVAL',
        'APPROVED'
    ])
);