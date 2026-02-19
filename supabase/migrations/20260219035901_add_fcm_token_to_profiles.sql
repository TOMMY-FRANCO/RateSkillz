/*
  # Add FCM token to profiles

  ## Summary
  Adds a `fcm_token` column to the `profiles` table so Firebase Cloud Messaging
  device tokens can be stored per user. The column is nullable because a user may
  not have granted push-notification permission yet.

  ## Changes
  - `profiles`: new nullable text column `fcm_token`

  ## Security
  - No RLS changes needed; the column is on an existing table that already has
    RLS policies. Users can only update their own profile row.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'fcm_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN fcm_token text;
  END IF;
END $$;
