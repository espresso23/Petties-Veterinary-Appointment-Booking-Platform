-- ============================================
-- Add pet_id column to booking_services table
-- For multi-pet booking support (each service can be for a different pet)
-- ============================================

-- Add pet_id column (nullable for backward compatibility)
ALTER TABLE booking_services ADD COLUMN IF NOT EXISTS pet_id UUID;

-- Add foreign key constraint (note: pets table uses pet_id as primary key)
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'fk_booking_services_pet'
	) THEN
		ALTER TABLE booking_services
		ADD CONSTRAINT fk_booking_services_pet
		FOREIGN KEY (pet_id) REFERENCES pets(pet_id) ON DELETE SET NULL;
	END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_services_pet_id ON booking_services(pet_id);