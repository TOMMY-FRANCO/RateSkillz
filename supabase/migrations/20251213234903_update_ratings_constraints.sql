/*
  # Update Ratings Table Constraints

  ## Overview
  Updating the ratings table to support 1-100 range with default values of 50 for all skills.

  ## Table Modifications

  ### ratings
  - Update constraints: Change from 0-99 to 1-100 range for all skill ratings
  - Add default values: Set default to 50 for all skill ratings (pac, sho, pas, dri, def, phy)
  - Add updated_at column with trigger for tracking when ratings are modified

  ## Important Notes

  1. **Default Values**: All new ratings start at 50 for each skill
  2. **Range**: Ratings must be between 1 and 100 (inclusive)
  3. **Update Tracking**: Automatically tracks when ratings are modified
  4. **Friend Editable**: Friends can update their ratings for a player unlimited times
*/

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old constraints and add new ones with 1-100 range and defaults
DO $$
BEGIN
  -- Drop old constraints if they exist
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_pac_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_sho_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_pas_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_dri_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_def_check;
  ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_phy_check;
END $$;

-- Add new constraints with 1-100 range
ALTER TABLE ratings 
  ALTER COLUMN pac SET DEFAULT 50,
  ALTER COLUMN sho SET DEFAULT 50,
  ALTER COLUMN pas SET DEFAULT 50,
  ALTER COLUMN dri SET DEFAULT 50,
  ALTER COLUMN def SET DEFAULT 50,
  ALTER COLUMN phy SET DEFAULT 50,
  ADD CONSTRAINT ratings_pac_check CHECK (pac >= 1 AND pac <= 100),
  ADD CONSTRAINT ratings_sho_check CHECK (sho >= 1 AND sho <= 100),
  ADD CONSTRAINT ratings_pas_check CHECK (pas >= 1 AND pas <= 100),
  ADD CONSTRAINT ratings_dri_check CHECK (dri >= 1 AND dri <= 100),
  ADD CONSTRAINT ratings_def_check CHECK (def >= 1 AND def <= 100),
  ADD CONSTRAINT ratings_phy_check CHECK (phy >= 1 AND phy <= 100);

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ratings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE ratings ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create trigger for updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_ratings_updated_at ON ratings;
CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();