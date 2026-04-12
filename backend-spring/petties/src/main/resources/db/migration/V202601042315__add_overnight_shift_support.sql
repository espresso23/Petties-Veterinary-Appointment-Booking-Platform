-- Flyway migration for overnight shift support
-- Version: V202601042315
-- Description: Add is_overnight column and remove unique constraint to allow multiple shifts per day

-- Step 1: Add is_overnight column to vet_shifts table
ALTER TABLE vet_shifts
ADD COLUMN IF NOT EXISTS is_overnight BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Remove the unique constraint that limits 1 shift per vet per day
-- This allows vets to have multiple shifts in a day (e.g., morning + evening, or morning + night)
ALTER TABLE vet_shifts DROP CONSTRAINT IF EXISTS unique_vet_date;

-- Step 3: Add comment explaining the column
COMMENT ON COLUMN vet_shifts.is_overnight IS 'If true, end_time is on the following day (e.g., 22:00 start -> 06:00 end next day)';

-- Note: The overlap check is handled by the application logic using
-- existsByVet_UserIdAndWorkDateAndTimeRange() which checks time ranges, not just dates.