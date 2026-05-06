-- Add sos_fee column for clinic_price_per_km
ALTER TABLE clinic_price_per_km
    ADD COLUMN IF NOT EXISTS sos_fee NUMERIC(12, 2);
