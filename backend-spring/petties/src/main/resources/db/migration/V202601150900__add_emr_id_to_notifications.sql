-- Add emr_id column to notifications table for Re-examination reminders
-- EmrRecord is stored in MongoDB, so we reference it by string ID

ALTER TABLE notifications 
ADD COLUMN emr_id VARCHAR(100) NULL;

-- Optional: Add index for faster lookups
CREATE INDEX idx_notifications_emr_id ON notifications(emr_id);
