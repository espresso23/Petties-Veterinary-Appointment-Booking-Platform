-- Add address field to users table for Pet Owner's address
-- V202601140003__add_address_to_users.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500);

-- Add index for address lookups
CREATE INDEX IF NOT EXISTS idx_users_address ON users (address)
WHERE
    address IS NOT NULL;

COMMENT ON COLUMN users.address IS 'User address - used for Pet Owner home address in bookings';