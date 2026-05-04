-- ============================================
-- Add missing columns to bookings table
-- For pricing support: discount_amount, final_price, sos_fee
-- ============================================

-- Add discount_amount column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'discount_amount'
    ) THEN
        ALTER TABLE bookings ADD COLUMN discount_amount NUMERIC(12, 2) DEFAULT 0;
    END IF;
END $$;

-- Add final_price column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'final_price'
    ) THEN
        ALTER TABLE bookings ADD COLUMN final_price NUMERIC(12, 2) DEFAULT 0;
    END IF;
END $$;

-- Add sos_fee column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' AND column_name = 'sos_fee'
    ) THEN
        ALTER TABLE bookings ADD COLUMN sos_fee NUMERIC(12, 2) DEFAULT 0;
    END IF;
END $$;