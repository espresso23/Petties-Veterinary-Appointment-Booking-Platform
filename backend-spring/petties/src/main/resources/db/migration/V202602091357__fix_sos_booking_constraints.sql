-- Fix: Exclude SOS bookings from unique_active_booking_per_pet_time constraint
-- Date: 2026-02-09
-- Reason: SOS bookings have clinic_id=NULL during matching phase, causing constraint violation
-- Business Rules: BR-62 (No duplicate active SOS bookings) handled at application level

-- Step 1: Drop existing index
DROP INDEX IF EXISTS unique_active_booking_per_pet_time;

-- Step 2: Create new index that excludes SOS bookings
-- SOS bookings are handled separately with clinic_id=NULL during SEARCHING/PENDING_CLINIC_CONFIRM phases
CREATE UNIQUE INDEX unique_active_booking_per_pet_time ON bookings (
    pet_id,
    clinic_id,
    booking_date,
    booking_time
)
WHERE
    status NOT IN('CANCELLED', 'NO_SHOW')
    AND type = 'IN_CLINIC';

-- Step 3: Create separate index for SOS active bookings
-- This ensures BR-62 at database level for SOS bookings specifically
CREATE UNIQUE INDEX unique_active_sos_booking_per_pet ON bookings (
    pet_id,
    booking_date,
    booking_time
)
WHERE
    type = 'SOS'
    AND status IN ('SEARCHING', 'PENDING_CLINIC_CONFIRM', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS');

-- Add comments for future reference
COMMENT ON INDEX unique_active_booking_per_pet_time IS 
    'Prevents duplicate active IN_CLINIC bookings for same pet at same time. SOS bookings excluded (BR-59 to BR-66).';

COMMENT ON INDEX unique_active_sos_booking_per_pet IS 
    'Ensures BR-62: Pet Owner cannot have multiple active SOS bookings.';
