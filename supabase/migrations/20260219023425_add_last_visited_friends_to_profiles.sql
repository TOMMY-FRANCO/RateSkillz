/*
  # Add last_visited_friends to profiles

  ## Changes
  - Adds `last_visited_friends` (timestamptz) column to `profiles`
  - Used to track when the user last visited the Friends page
  - Allows computing unread accepted friend request badge counts since last visit
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_visited_friends'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_visited_friends timestamptz;
  END IF;
END $$;
