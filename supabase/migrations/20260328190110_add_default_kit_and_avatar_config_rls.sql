/*
  # Ensure default kit exists and RLS policies for kit tables

  1. Changes
    - Insert a default "Classic White" kit if none exists
    - Enable RLS on kit_items and user_kits
    - Add policies so authenticated users can read kit_items and manage their own user_kits

  2. Security
    - kit_items: public read (authenticated), admin write
    - user_kits: users can read/insert/update their own rows
*/

ALTER TABLE kit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_kits ENABLE ROW LEVEL SECURITY;

-- kit_items: anyone authenticated can read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'kit_items' AND policyname = 'Authenticated users can read kit items'
  ) THEN
    CREATE POLICY "Authenticated users can read kit items"
      ON kit_items FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- user_kits: users can read their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_kits' AND policyname = 'Users can read own kits'
  ) THEN
    CREATE POLICY "Users can read own kits"
      ON user_kits FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- user_kits: users can insert their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_kits' AND policyname = 'Users can insert own kits'
  ) THEN
    CREATE POLICY "Users can insert own kits"
      ON user_kits FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- user_kits: users can update their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_kits' AND policyname = 'Users can update own kits'
  ) THEN
    CREATE POLICY "Users can update own kits"
      ON user_kits FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Insert the default free kit if it doesn't exist
INSERT INTO kit_items (name, description, price_gbp, kit_primary_color, kit_secondary_color, kit_pattern, is_active)
SELECT 'Classic White', 'The original RatingSkill kit — clean white with blue accents.', 0.00, '#FFFFFF', '#1E40AF', 'plain', true
WHERE NOT EXISTS (SELECT 1 FROM kit_items WHERE price_gbp = 0);
