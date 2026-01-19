-- Migration to add ward column to clinics table
-- Created at: 2025-12-30 23:00
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS ward VARCHAR(100);