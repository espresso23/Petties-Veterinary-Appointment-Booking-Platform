-- Add missing target_count column used by SystemNotification entity
ALTER TABLE system_notifications
ADD COLUMN IF NOT EXISTS target_count INTEGER;

-- Backfill existing rows
UPDATE system_notifications
SET target_count = 0
WHERE target_count IS NULL;

-- Enforce non-null for future writes
ALTER TABLE system_notifications
ALTER COLUMN target_count SET NOT NULL;
