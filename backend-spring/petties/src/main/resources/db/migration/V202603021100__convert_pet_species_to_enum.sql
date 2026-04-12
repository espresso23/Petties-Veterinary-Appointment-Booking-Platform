-- Migration: Convert pet.species from String to Enum
-- Purpose: Standardize species values for vaccine compatibility validation

-- Step 1: Add new species_enum column
ALTER TABLE pets ADD COLUMN species_enum VARCHAR(20);

-- Step 2: Migrate existing data - normalize various input formats
UPDATE pets SET species_enum =
    CASE
        -- DOG variations (Vietnamese & English)
        WHEN LOWER(TRIM(species)) IN ('dog', 'chó', 'cho', 'cún', 'cun', 'cẩu') THEN 'DOG'
        -- CAT variations
        WHEN LOWER(TRIM(species)) IN ('cat', 'mèo', 'meo', 'kitty', 'miu') THEN 'CAT'
        -- BIRD variations
        WHEN LOWER(TRIM(species)) IN ('bird', 'chim', 'vẹt', 'vet', 'yến', 'yen', 'sáo') THEN 'BIRD'
        -- RABBIT variations
        WHEN LOWER(TRIM(species)) IN ('rabbit', 'thỏ', 'tho', 'bunny') THEN 'RABBIT'
        -- HAMSTER variations
        WHEN LOWER(TRIM(species)) IN ('hamster', 'chuột hamster', 'chuot hamster', 'chuột', 'chuot') THEN 'HAMSTER'
        -- FISH variations
        WHEN LOWER(TRIM(species)) IN ('fish', 'cá', 'ca') THEN 'FISH'
        -- Default to OTHER for unrecognized
        ELSE 'OTHER'
    END;

-- Step 3: Drop old column and rename new column
ALTER TABLE pets DROP COLUMN species;
ALTER TABLE pets RENAME COLUMN species_enum TO species;

-- Step 4: Add NOT NULL constraint
ALTER TABLE pets ALTER COLUMN species SET NOT NULL;

-- Step 5: Add check constraint for valid enum values
ALTER TABLE pets ADD CONSTRAINT chk_pet_species
    CHECK (species IN ('DOG', 'CAT', 'BIRD', 'RABBIT', 'HAMSTER', 'FISH', 'OTHER'));
