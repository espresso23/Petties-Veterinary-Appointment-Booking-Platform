-- Add partial unique index to prevent duplicate ACTIVE bookings for same pet at same time
-- This allows users to cancel and rebook at the same time slot
-- Only prevents duplicate bookings with status NOT IN ('CANCELLED', 'NO_SHOW')

-- Step 1: Clean up existing duplicate active bookings (keep the latest one)
-- This is necessary to create the unique index
WITH duplicates AS (
    SELECT booking_id,
           ROW_NUMBER() OVER (
               PARTITION BY pet_id, clinic_id, booking_date, booking_time
               ORDER BY created_at DESC
           ) as rn
    FROM bookings
    WHERE status NOT IN ('CANCELLED', 'NO_SHOW')
)
UPDATE bookings
SET status = 'CANCELLED',
    notes = COALESCE(notes, '') || ' [Auto-cancelled: Duplicate booking cleanup during migration]'
WHERE booking_id IN (
    SELECT booking_id FROM duplicates WHERE rn > 1
);

-- Step 2: Drop index if exists (to handle partial migration failures)
DROP INDEX IF EXISTS unique_active_booking_per_pet_time;

-- Step 3: Create the unique index
CREATE UNIQUE INDEX unique_active_booking_per_pet_time ON bookings (
    pet_id,
    clinic_id,
    booking_date,
    booking_time
)
WHERE
    status NOT IN('CANCELLED', 'NO_SHOW');

-- Add comment for future reference
COMMENT ON INDEX unique_active_booking_per_pet_time IS 'Prevents duplicate active bookings for same pet at same time. Allows rebooking after cancellation.';