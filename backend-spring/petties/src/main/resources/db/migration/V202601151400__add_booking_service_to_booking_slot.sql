-- Add booking_service_id column to booking_slots table
-- This links each slot to a specific service in the booking
-- Allows us to know which service a slot belongs to for display purposes

ALTER TABLE booking_slots
ADD COLUMN IF NOT EXISTS booking_service_id UUID REFERENCES booking_services(booking_service_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_slots_booking_service ON booking_slots(booking_service_id);
