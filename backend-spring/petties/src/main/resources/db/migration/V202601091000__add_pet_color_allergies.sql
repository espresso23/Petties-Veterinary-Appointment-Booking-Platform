-- Add color and allergies columns to pets table for enhanced pet information
-- Color: Required field for pet's fur/skin color
-- Allergies: Optional text field for known allergies

ALTER TABLE pets ADD COLUMN IF NOT EXISTS color VARCHAR(100);
ALTER TABLE pets ADD COLUMN IF NOT EXISTS allergies TEXT;

-- Add comment for documentation
COMMENT ON COLUMN pets.color IS 'Pet fur/skin color (e.g., Brown, Black, White, Mixed)';
COMMENT ON COLUMN pets.allergies IS 'Known allergies of the pet (optional, free text)';
