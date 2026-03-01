-- Flyway Migration: Simplify staff specialty from 5 to 2 (VET, GROOMER)
-- Description: Maps VET_GENERAL, VET_SURGERY, VET_DENTAL, VET_DERMATOLOGY to VET
-- Date: 2026-02-28

UPDATE users
SET specialty = 'VET'
WHERE specialty IN ('VET_GENERAL', 'VET_SURGERY', 'VET_DENTAL', 'VET_DERMATOLOGY');
