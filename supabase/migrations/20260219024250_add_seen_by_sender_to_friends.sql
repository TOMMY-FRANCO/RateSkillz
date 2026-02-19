/*
  # Add seen_by_sender to friends table

  ## Changes
  - Adds `seen_by_sender` (boolean, default false) to the `friends` table
  - When a friend request is accepted by the receiver, `seen_by_sender` starts as false
  - When the original sender visits the Friends page, all accepted rows where they are
    the sender (user_id) are flipped to true, clearing the dashboard badge
  - The dashboard badge only counts rows where user_id = current user, status = accepted,
    and seen_by_sender = false
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'friends' AND column_name = 'seen_by_sender'
  ) THEN
    ALTER TABLE friends ADD COLUMN seen_by_sender boolean NOT NULL DEFAULT false;
  END IF;
END $$;
