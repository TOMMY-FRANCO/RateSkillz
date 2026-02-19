/*
  # Add is_prewritten flag to messages table

  ## Summary
  Adds a boolean column `is_prewritten` to the messages table to distinguish
  pre-written quick messages (football chip messages) from regular typed messages.
  This flag enables the daily limit tracking (max 3 pre-written messages per
  sender/recipient pair per calendar day, resetting at midnight UTC).

  ## Changes
  - `messages` table: adds `is_prewritten` boolean column defaulting to false

  ## Notes
  - No data loss - existing rows default to false (regular messages)
  - Limit enforcement is done at query time using created_at + is_prewritten
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_prewritten'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_prewritten boolean NOT NULL DEFAULT false;
  END IF;
END $$;
