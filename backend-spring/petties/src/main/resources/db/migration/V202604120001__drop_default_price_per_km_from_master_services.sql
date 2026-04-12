-- Remove legacy default_price_per_km from master_services
-- pricePerKm is now managed at clinic level via clinic_price_per_km table
-- See: V202602041515__remove_price_per_km_from_clinic_services.sql

ALTER TABLE master_services DROP COLUMN IF EXISTS default_price_per_km;
