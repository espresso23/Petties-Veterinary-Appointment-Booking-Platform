-- Migration: Add denormalized payment_status and payment_method columns to bookings
-- Purpose: Avoid joins to payments table for payment status checks; enables cleaner queries
-- Reference: Booking.java entity update (paymentStatus, paymentMethod fields)

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20);

-- Backfill from existing payments records
UPDATE bookings b
SET payment_status = p.status,
    payment_method = p.method
FROM payments p
WHERE p.booking_id = b.booking_id;
