-- ============================================
-- Migration: Add soft delete support to pets table
-- Date: 2026-02-09
-- Description: Add deleted_at column for soft delete functionality
-- ============================================

-- Add deleted_at column for soft delete
ALTER TABLE pets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for efficient filtering of non-deleted pets
CREATE INDEX IF NOT EXISTS idx_pets_deleted_at ON pets (deleted_at);

-- Add comment for documentation
COMMENT ON COLUMN pets.deleted_at IS 'Soft delete timestamp - if not null, pet is considered deleted';