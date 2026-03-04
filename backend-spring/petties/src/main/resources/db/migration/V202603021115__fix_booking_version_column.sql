-- Fix NULL version column in bookings table to support Hibernate optimistic locking
-- Date: 2026-03-02
-- Description: Initialize version = 0 for all existing bookings and set NOT NULL constraint

-- 1. Initialize existing NULL values to 0
UPDATE bookings SET version = 0 WHERE version IS NULL;

-- 2. Set default value for future rows
ALTER TABLE bookings ALTER COLUMN version SET DEFAULT 0;

-- 3. Set NOT NULL constraint
ALTER TABLE bookings ALTER COLUMN version SET NOT NULL;
