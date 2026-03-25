-- Fix NULL version column in bookings table to support Hibernate optimistic locking
-- Date: 2026-03-02
-- Description: Initialize version = 0 for all existing bookings and set NOT NULL constraint

-- 1. Add column if it doesn't exist (must not use IF NOT EXISTS since it's an older PG version, but Flyway handles repeats)
ALTER TABLE bookings ADD COLUMN version INT DEFAULT 0;

-- 2. Ensure NO NULL values
UPDATE bookings SET version = 0 WHERE version IS NULL;

-- 3. Set NOT NULL constraint
ALTER TABLE bookings ALTER COLUMN version SET NOT NULL;
