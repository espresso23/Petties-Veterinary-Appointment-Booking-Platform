-- Flyway Migration: Add Vet specialty and rating fields to users table
-- Version: V202601110108
-- Description: Adds specialty, rating_avg, rating_count columns for Vet users

ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty VARCHAR(100);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(2, 1) DEFAULT 0.0;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- Create index for specialty search
CREATE INDEX IF NOT EXISTS idx_users_specialty ON users (specialty)
WHERE
    specialty IS NOT NULL;
