-- Fix bookings.version type to BIGINT for optimistic locking
ALTER TABLE bookings
    ALTER COLUMN version TYPE BIGINT USING version::BIGINT;
