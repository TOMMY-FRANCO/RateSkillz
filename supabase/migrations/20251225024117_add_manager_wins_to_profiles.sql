/*
  # Add Manager Wins Column to Profiles

  1. Changes
    - Add `manager_wins` column to profiles table to track battle victories
    - Default value is 0
    - Column is nullable and updatable

  2. Purpose
    - Support "Search Friends" feature showing manager status with win count
    - Enable filtering and sorting by manager performance
*/

-- Add manager_wins column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'manager_wins'
  ) THEN
    ALTER TABLE profiles ADD COLUMN manager_wins integer DEFAULT 0;
  END IF;
END $$;

-- Update existing managers' win counts from battles table
UPDATE profiles
SET manager_wins = (
  SELECT COUNT(*)
  FROM battles
  WHERE battles.winner_id = profiles.id
  AND battles.status = 'completed'
)
WHERE is_manager = true;