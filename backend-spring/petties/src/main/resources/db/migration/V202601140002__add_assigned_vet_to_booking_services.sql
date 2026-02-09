-- Add assigned_vet_id column to booking_services table
-- This allows each service in a booking to have its own assigned veterinarian

ALTER TABLE booking_services
ADD COLUMN IF NOT EXISTS assigned_vet_id UUID REFERENCES users (user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_booking_services_assigned_vet ON booking_services (assigned_vet_id);

-- Comment explaining the column
COMMENT ON COLUMN booking_services.assigned_vet_id IS 'Assigned veterinarian for this specific service. Different services in the same booking can have different vets based on specialty.';
