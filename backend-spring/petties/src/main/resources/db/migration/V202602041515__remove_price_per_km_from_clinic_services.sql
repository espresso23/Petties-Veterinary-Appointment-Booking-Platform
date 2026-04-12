-- Remove unused pricePerKm column from clinic_services table
-- Distance pricing is now managed at clinic level via clinic_price_per_km table

ALTER TABLE clinic_services DROP COLUMN IF EXISTS price_per_km;
