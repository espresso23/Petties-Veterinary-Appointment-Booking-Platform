-- ============================================
-- Add pet_id column to booking_services table
-- For multi-pet booking support (each service can be for a different pet)
-- ============================================

-- Add pet_id column (nullable for backward compatibility)
ALTER TABLE booking_services ADD COLUMN pet_id BIGINT;

-- Add foreign key constraint
ALTER TABLE booking_services 
ADD CONSTRAINT fk_booking_services_pet 
FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_booking_services_pet_id ON booking_services(pet_id);