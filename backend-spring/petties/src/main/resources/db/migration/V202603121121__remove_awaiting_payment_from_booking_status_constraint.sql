-- Remove AWAITING_PAYMENT from booking status check constraint

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

COMMENT ON COLUMN bookings.status IS 'Booking status without AWAITING_PAYMENT. Payment progress tracked by payment_status/payment_method.';
