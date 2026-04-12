-- ============================================
-- Migration: Extend booking status column length
-- Date: 2026-02-09
-- Description: Extend status column to accommodate longer status values like PENDING_CLINIC_CONFIRM
-- ============================================

-- Extend status column from varchar(20) to varchar(30)
ALTER TABLE bookings ALTER COLUMN status TYPE VARCHAR(30);

-- Update the CHECK constraint to include new SOS statuses
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
        'PENDING',
        'SEARCHING',
        'PENDING_CLINIC_CONFIRM',
        'CONFIRMED',
        'ASSIGNED',
        'ON_THE_WAY',
        'ARRIVED',
        'CHECK_IN',
        'IN_PROGRESS',
        'CHECK_OUT',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW'
    )
);

-- Add comment for documentation
COMMENT ON COLUMN bookings.status IS 'Booking status - extended to 30 chars for SOS statuses';