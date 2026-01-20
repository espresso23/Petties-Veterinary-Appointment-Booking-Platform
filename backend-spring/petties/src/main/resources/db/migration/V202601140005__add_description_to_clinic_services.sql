-- Add description column to clinic_services table
-- V202601140005__add_description_to_clinic_services.sql

ALTER TABLE clinic_services
ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN clinic_services.description IS 'Service description for clinic-specific services';