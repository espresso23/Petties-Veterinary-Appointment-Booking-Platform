-- Add FCM token column to users table for push notifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(500);

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_users_fcm_token ON users (fcm_token)
WHERE
    fcm_token IS NOT NULL;