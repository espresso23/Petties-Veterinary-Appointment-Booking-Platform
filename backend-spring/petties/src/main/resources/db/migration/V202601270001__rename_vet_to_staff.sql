-- Migration: Rename Role VET to STAFF
-- Date: 2025-01-27
-- Description: Change VET role to STAFF to support multiple staff types with specializations

-- Step 1: Drop the existing CHECK CONSTRAINT on role column (if exists)
-- PostgreSQL doesn't have a standard way to check if constraint exists before dropping,
-- so we use DO block with exception handling
DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
EXCEPTION
    WHEN undefined_object THEN
        -- Constraint doesn't exist, ignore
        NULL;
END $$;

-- Step 2: Update users table FIRST: VET -> STAFF (before adding constraint)
UPDATE users SET role = 'STAFF' WHERE role = 'VET';

-- Step 3: Add new CHECK CONSTRAINT with STAFF instead of VET (after data is updated)
ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('PET_OWNER', 'STAFF', 'CLINIC_MANAGER', 'CLINIC_OWNER', 'ADMIN'));

-- Note: This migration:
-- 1. Drops the old CHECK CONSTRAINT that only allowed 'VET'
-- 2. Updates existing VET users to STAFF
-- 3. Creates new CHECK CONSTRAINT with 'STAFF'
--
-- The StaffSpecialty enum (VET_GENERAL, VET_SURGERY, VET_DENTAL, VET_DERMATOLOGY, GROOMER) remains unchanged
-- and is used to differentiate between different types of STAFF.
