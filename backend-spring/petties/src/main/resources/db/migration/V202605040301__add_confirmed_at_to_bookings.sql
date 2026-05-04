-- ============================================
-- Add confirmed_at column to bookings table
-- For tracking when booking is confirmed by clinic
-- ============================================

-- Add confirmed_at column if not exists (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'confirmed_at'
    ) THEN
        ALTER TABLE bookings ADD COLUMN confirmed_at TIMESTAMP;
    END IF;
END $$;

-- Create index for confirmed_at (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_bookings_confirmed_at'
    ) THEN
        CREATE INDEX idx_bookings_confirmed_at ON bookings(confirmed_at);
    END IF;
END $$;