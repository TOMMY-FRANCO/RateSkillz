-- Add terms acceptance tracking to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'terms_accepted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN terms_accepted_at timestamptz;
  END IF;
END $$;

-- Set existing users' terms acceptance to their account creation date
UPDATE profiles
SET terms_accepted_at = created_at
WHERE terms_accepted_at IS NULL AND created_at IS NOT NULL;

-- For users without created_at, set to now
UPDATE profiles
SET terms_accepted_at = now()
WHERE terms_accepted_at IS NULL;
