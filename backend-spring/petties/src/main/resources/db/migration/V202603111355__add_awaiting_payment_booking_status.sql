-- Migration: Add AWAITING_PAYMENT booking status
-- Date: 2026-03-11
-- Description: Support post-checkout flow where booking is completed medically but awaiting payment

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
        'PENDING',
        'SEARCHING',
        'PENDING_CLINIC_CONFIRM',
        'CONFIRMED',
        'IN_PROGRESS',
        'AWAITING_PAYMENT',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW'
    )
);

COMMENT ON COLUMN bookings.status IS 'Booking status includes AWAITING_PAYMENT before final COMPLETED';
