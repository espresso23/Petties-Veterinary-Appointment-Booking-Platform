-- Migration: Migrate legacy booking statuses to current enum values
-- Date: 2026-02-24

-- 1. Update legacy statuses to new equivalents
-- Note: 'ASSIGNED' is not in current enum, replacing with 'CONFIRMED'
UPDATE bookings SET status = 'CONFIRMED' WHERE status = 'ASSIGNED';

-- 'ON_THE_WAY', 'ARRIVED', 'CHECK_IN' are not in current enum, replacing with 'IN_PROGRESS'
UPDATE bookings
SET
    status = 'IN_PROGRESS'
WHERE
    status IN (
        'ON_THE_WAY',
        'ARRIVED',
        'CHECK_IN'
    );

-- 'CHECK_OUT' is not in current enum, replacing with 'COMPLETED'
UPDATE bookings SET status = 'COMPLETED' WHERE status = 'CHECK_OUT';

-- 2. Update the CHECK constraint to match Java enum BookingStatus
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
        'PENDING',
        'SEARCHING',
        'PENDING_CLINIC_CONFIRM',
        'CONFIRMED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW'
    )
);

-- Add comment for documentation
COMMENT ON COLUMN bookings.status IS 'Booking status - standardized to match Java enum BookingStatus';