-- Update notification type constraint to include all Java Enum values + existing legacy types
-- V202601241150__update_notification_type_constraint_full.sql

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
        -- Existing types from V202601140004
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
        'APPROVED',
        
        -- New types from Java NotificationType enum
        'REJECTED',
        'PENDING',
        'BOOKING_CHECKIN',
        'BOOKING_COMPLETED',
        'VET_ON_WAY',
        'CLINIC_VERIFIED',
        'RE_EXAMINATION_REMINDER',
        'VACCINATION_REMINDER'
    ])
);
