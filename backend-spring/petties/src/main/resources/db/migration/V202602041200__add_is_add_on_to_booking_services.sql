-- Add is_add_on column to booking_services table
ALTER TABLE booking_services
ADD COLUMN is_add_on BOOLEAN DEFAULT FALSE;

-- Update existing records to have is_add_on = false
UPDATE booking_services
SET
    is_add_on = FALSE
WHERE
    is_add_on IS NULL;