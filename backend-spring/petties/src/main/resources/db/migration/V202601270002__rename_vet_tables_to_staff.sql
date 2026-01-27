-- Migration: Rename Vet Tables and Columns to Staff
-- Date: 2025-01-27
-- Description: Rename vet_shifts → staff_shifts, assigned_vet_id → assigned_staff_id
-- Updated: Added IF EXISTS checks to handle both fresh DB and existing DB scenarios

-- =========================================================
-- STEP 1: Rename vet_shifts table to staff_shifts (if exists)
-- =========================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'vet_shifts') THEN
        ALTER TABLE vet_shifts RENAME TO staff_shifts;
    END IF;
END $$;

-- =========================================================
-- STEP 2: Rename vet_id column to staff_id in staff_shifts (if exists)
-- =========================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_name = 'staff_shifts' AND column_name = 'vet_id') THEN
        ALTER TABLE staff_shifts RENAME COLUMN vet_id TO staff_id;
    END IF;
END $$;

-- =========================================================
-- STEP 3: Rename assigned_vet_id → assigned_staff_id in bookings table (if exists)
-- =========================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_name = 'bookings' AND column_name = 'assigned_vet_id') THEN
        ALTER TABLE bookings RENAME COLUMN assigned_vet_id TO assigned_staff_id;
    END IF;
END $$;

-- =========================================================
-- STEP 4: Rename assigned_vet_id → assigned_staff_id in booking_services table (if exists)
-- =========================================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_name = 'booking_services' AND column_name = 'assigned_vet_id') THEN
        ALTER TABLE booking_services RENAME COLUMN assigned_vet_id TO assigned_staff_id;
    END IF;
END $$;

-- =========================================================
-- STEP 5: Drop old indexes (if exist)
-- =========================================================
DROP INDEX IF EXISTS idx_shift_vet_date;
DROP INDEX IF EXISTS idx_shift_clinic_date;
DROP INDEX IF EXISTS idx_bookings_assigned_vet_id;
DROP INDEX IF EXISTS idx_booking_services_assigned_vet;

-- =========================================================
-- STEP 6: Create new indexes (if not exist)
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_shift_staff_date ON staff_shifts (staff_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shift_clinic_date ON staff_shifts (clinic_id, work_date);
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_staff_id ON bookings (assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_assigned_staff ON booking_services (assigned_staff_id);

-- =========================================================
-- STEP 7: Update unique constraint (handle existing)
-- =========================================================
DO $$
BEGIN
    -- Drop old constraint if exists
    IF EXISTS (SELECT FROM pg_constraint WHERE conname = 'unique_vet_date') THEN
        ALTER TABLE staff_shifts DROP CONSTRAINT unique_vet_date;
    END IF;

    -- Create new constraint if not exists
    IF NOT EXISTS (SELECT FROM pg_constraint WHERE conname = 'unique_staff_date') THEN
        ALTER TABLE staff_shifts ADD CONSTRAINT unique_staff_date UNIQUE (staff_id, work_date);
    END IF;
END $$;

-- =========================================================
-- STEP 8: Update comments to reflect new naming
-- =========================================================
COMMENT ON TABLE staff_shifts IS 'Staff work shifts - each shift generates multiple 30-min slots';
COMMENT ON COLUMN staff_shifts.staff_id IS 'Staff member ID (formerly vet_id)';
COMMENT ON COLUMN staff_shifts.break_start IS 'Optional break start time - slots not generated during break';
COMMENT ON COLUMN staff_shifts.break_end IS 'Optional break end time';

COMMENT ON COLUMN booking_services.assigned_staff_id IS 'Assigned staff member for this specific service. Different services in the same booking can have different staff based on specialty.';

-- Note: This migration renames:
-- 1. Table: vet_shifts → staff_shifts (if vet_shifts exists)
-- 2. Column: staff_shifts.vet_id → staff_shifts.staff_id (if vet_id column exists)
-- 3. Column: bookings.assigned_vet_id → bookings.assigned_staff_id (if column exists)
-- 4. Column: booking_services.assigned_vet_id → booking_services.assigned_staff_id (if column exists)
-- 5. Indexes and constraints updated accordingly
--
-- The IF EXISTS checks allow this migration to run safely on:
-- - Existing databases with vet_shifts table (will rename)
-- - New databases where staff_shifts was created directly (will skip rename)
