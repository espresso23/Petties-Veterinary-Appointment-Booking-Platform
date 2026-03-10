-- Add version column for JPA Optimistic Locking support on clinic_price_per_km
ALTER TABLE clinic_price_per_km ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
