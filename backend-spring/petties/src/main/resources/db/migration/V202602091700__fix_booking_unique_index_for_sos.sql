-- Fix: Unique index only applies to IN_CLINIC bookings, not SOS
-- SOS bookings have clinic_id = NULL initially and different flow

-- Step 1: Drop existing index
DROP INDEX IF EXISTS unique_active_booking_per_pet_time;

-- Step 2: Create new index that only applies to IN_CLINIC bookings
CREATE UNIQUE INDEX unique_active_booking_per_pet_time ON bookings (
    pet_id,
    clinic_id,
    booking_date,
    booking_time
)
WHERE
    status NOT IN('CANCELLED', 'NO_SHOW')
    AND type = 'IN_CLINIC';

-- Add comment for future reference
COMMENT ON INDEX unique_active_booking_per_pet_time IS
    'Prevents duplicate active IN_CLINIC bookings for same pet at same time. Does not apply to SOS bookings.';
