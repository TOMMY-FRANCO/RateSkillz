/*
  # Remove fcm_token column from profiles

  Firebase Cloud Messaging has been removed from the app.
  This migration drops the fcm_token column that was used to store
  device push notification tokens.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'fcm_token'
  ) THEN
    ALTER TABLE profiles DROP COLUMN fcm_token;
  END IF;
END $$;
