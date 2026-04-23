-- Add Sandbox Workspace Support to Clinics
-- Version: V202604091430
-- Purpose: Enable Clinic Owners/Managers to practice with mock data before handling real patients

-- Add columns to clinics table
ALTER TABLE clinics
  ADD COLUMN is_sandbox BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN sandbox_owner_id UUID,
  ADD COLUMN sandbox_expires_at TIMESTAMP NULL;

-- Add foreign key constraint for sandbox_owner_id
ALTER TABLE clinics
  ADD CONSTRAINT fk_clinics_sandbox_owner_id
    FOREIGN KEY (sandbox_owner_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- Add index for CRON cleanup query (finding stale sandboxes)
CREATE INDEX idx_sandbox_cleanup 
  ON clinics(is_sandbox, created_at) 
  WHERE is_sandbox = true;

-- Ensure CASCADE DELETE constraints exist for related tables
-- These constraints ensure that when a sandbox clinic is deleted,
-- all associated data (bookings, services, shifts, EMRs) are automatically deleted

-- Update bookings FK to have CASCADE DELETE if not already set
ALTER TABLE IF EXISTS bookings
  DROP CONSTRAINT IF EXISTS fk_bookings_clinic_cascade;

ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_clinic_cascade
    FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE;

-- Update clinic_services FK to have CASCADE DELETE
ALTER TABLE IF EXISTS clinic_services
  DROP CONSTRAINT IF EXISTS fk_clinic_services_clinic_cascade;

ALTER TABLE clinic_services
  ADD CONSTRAINT fk_clinic_services_clinic_cascade
    FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE;

-- Update staff_shifts FK to have CASCADE DELETE
ALTER TABLE IF EXISTS staff_shifts
  DROP CONSTRAINT IF EXISTS fk_staff_shifts_clinic_cascade;

ALTER TABLE staff_shifts
  ADD CONSTRAINT fk_staff_shifts_clinic_cascade
    FOREIGN KEY (clinic_id) REFERENCES clinics(clinic_id) ON DELETE CASCADE;

-- For emr_records (MongoDB collection), we'll handle via service layer
-- No SQL constraint needed, but leaving note for developer

-- Add comment for future reference
COMMENT ON COLUMN clinics.is_sandbox IS 'Whether this clinic is a sandbox for testing/learning (true) or production (false)';
COMMENT ON COLUMN clinics.sandbox_owner_id IS 'User ID of the owner who created this sandbox clinic';
COMMENT ON COLUMN clinics.sandbox_expires_at IS 'Timestamp when this sandbox should auto-delete (24 hours after creation)';
