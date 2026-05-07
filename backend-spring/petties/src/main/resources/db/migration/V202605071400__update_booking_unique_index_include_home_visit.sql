-- Update unique index to include HOME_VISIT
-- Prevents a pet from having multiple active bookings (In-clinic or Home visit) at the same time

DROP INDEX IF EXISTS unique_active_booking_per_pet_time;

CREATE UNIQUE INDEX unique_active_booking_per_pet_time ON bookings (
    pet_id,
    clinic_id,
    booking_date,
    booking_time
)
WHERE
    status NOT IN ('CANCELLED', 'NO_SHOW', 'REJECTED')
    AND type IN ('IN_CLINIC', 'HOME_VISIT');

COMMENT ON INDEX unique_active_booking_per_pet_time IS
    'Prevents duplicate active IN_CLINIC or HOME_VISIT bookings for same pet at same clinic at same time.';
