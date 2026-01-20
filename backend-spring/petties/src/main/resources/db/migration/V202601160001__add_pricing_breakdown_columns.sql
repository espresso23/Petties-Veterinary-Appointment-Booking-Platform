-- Add pricing breakdown columns to booking_services and bookings table
-- base_price/weight_price are per-service
-- distance_fee is per-booking

ALTER TABLE booking_services
ADD COLUMN IF NOT EXISTS base_price DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS weight_price DECIMAL(12, 2);

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS distance_fee DECIMAL(12, 2);

-- Add comments for clarity (these are safe to re-run)
COMMENT ON COLUMN booking_services.base_price IS 'Original base price of the service';

COMMENT ON COLUMN booking_services.weight_price IS 'Price tier based on pet weight';

COMMENT ON COLUMN bookings.distance_fee IS 'Home visit fee applied once per booking (pricePerKm × distanceKm)';