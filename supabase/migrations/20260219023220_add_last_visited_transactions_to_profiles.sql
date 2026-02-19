/*
  # Add last_visited_transactions to profiles

  ## Changes
  - Adds `last_visited_transactions` (timestamptz) column to `profiles`
  - Used to track when the user last visited the Transactions page
  - Allows computing unread/new transaction badge counts since last visit
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_visited_transactions'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_visited_transactions timestamptz;
  END IF;
END $$;
