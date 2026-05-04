-- ============================================
-- Add arrived_at column to bookings table
-- For tracking when pet arrives at clinic
-- ============================================

-- Add arrived_at column if not exists (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'arrived_at'
    ) THEN
        ALTER TABLE bookings ADD COLUMN arrived_at TIMESTAMP;
    END IF;
END $$;

-- Create index for arrived_at (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_bookings_arrived_at'
    ) THEN
        CREATE INDEX idx_bookings_arrived_at ON bookings(arrived_at);
    END IF;
END $$;