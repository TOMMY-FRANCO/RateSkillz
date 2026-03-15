/*
  # Add city and is_city_visible columns to profiles

  ## Summary
  Adds two new nullable columns to the profiles table:

  1. `city` (text, nullable) - Stores the user's selected city
  2. `is_city_visible` (boolean, nullable, default false) - Controls whether the city is shown on the public profile

  ## Changes
  - profiles: add `city` text column (nullable, no default)
  - profiles: add `is_city_visible` boolean column (nullable, default false)

  ## Notes
  - No RLS changes needed; these columns are on the existing profiles table which already has policies in place
  - Existing rows will have NULL for city and FALSE for is_city_visible
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'city'
  ) THEN
    ALTER TABLE profiles ADD COLUMN city text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_city_visible'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_city_visible boolean DEFAULT false;
  END IF;
END $$;
