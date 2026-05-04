-- V202605040500__add_symptoms_to_bookings.sql
-- Add symptoms column for SOS booking symptom description

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS symptoms TEXT;