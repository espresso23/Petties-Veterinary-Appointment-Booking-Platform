-- Add action_type and action_data columns to notifications table
-- For supporting quick booking actions from notifications

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_data TEXT;
