-- Migration: Add shift_id column to notifications table for VetShift notifications
-- Date: 2025-01-05
-- Author: Claude Code

-- 1. Make clinic_id nullable (for VetShift notifications that don't have a clinic directly)
ALTER TABLE notifications ALTER COLUMN clinic_id DROP NOT NULL;

-- 2. Add shift_id column for VetShift-related notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS shift_id UUID;

-- 3. Add foreign key constraint to vet_shifts table
ALTER TABLE notifications
ADD CONSTRAINT fk_notification_shift
FOREIGN KEY (shift_id) REFERENCES vet_shifts(shift_id) ON DELETE SET NULL;

-- 4. Add index for shift_id lookups
CREATE INDEX IF NOT EXISTS idx_notification_shift ON notifications(shift_id);

-- 5. Add indexes for performance (if not exist)
CREATE INDEX IF NOT EXISTS idx_notification_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notification_read ON notifications(read);
