-- Add voucher_id column for bookings (nullable)
ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS voucher_id UUID;
