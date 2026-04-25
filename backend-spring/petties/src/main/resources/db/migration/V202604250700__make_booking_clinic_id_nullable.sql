-- Migration: Make clinic_id nullable in bookings table for SOS bookings
-- Date: 2026-04-25
-- Reason: SOS bookings have clinic_id = NULL during SEARCHING status

ALTER TABLE bookings ALTER COLUMN clinic_id DROP NOT NULL;

-- Add comment to explain why it is nullable
COMMENT ON COLUMN bookings.clinic_id IS 'NULL for SOS bookings during matching phase (SEARCHING status)';
