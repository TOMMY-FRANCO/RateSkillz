/*
  # Inactive Account Auto-Delete System

  1. Changes to `profiles` table
    - Add `last_activity_date` (timestamp) - tracks last user activity
    - Add `account_status` (text enum) - tracks account status (active/inactive/deleted)
    - Add `scheduled_deletion_date` (timestamp) - when account will be deleted
    - Add `deletion_warning_sent` (boolean) - tracks if 14-day warning was sent

  2. New Tables
    - `deletion_logs`
      - `id` (uuid, primary key)
      - `deleted_user_id` (uuid) - reference to deleted user
      - `deleted_username` (text) - username of deleted user for audit
      - `deletion_reason` (text) - reason for deletion
      - `coins_forfeited` (numeric) - amount of coins returned to pool
      - `deletion_date` (timestamp)
      - `profile_data_snapshot` (jsonb) - snapshot of profile before deletion

  3. Functions
    - `update_last_activity()` - updates last_activity_date for user
    - `process_inactive_account_deletions()` - processes batch deletions
    - `anonymize_deleted_user_references()` - replaces deleted user with [Deleted User]

  4. Security
    - Enable RLS on deletion_logs
    - Only authenticated users can access deletion logs

  5. Notes
    - Inactive = no activity for 90 days
    - Warning sent 14 days before deletion (at 76 days)
    - Coins forfeited back to coin_pool
    - User data deleted, references anonymized
*/

-- Add columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_activity_date'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN last_activity_date timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN account_status text DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'deleted'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'scheduled_deletion_date'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN scheduled_deletion_date timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'deletion_warning_sent'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN deletion_warning_sent boolean DEFAULT false;
  END IF;
END $$;

-- Create deletion_logs table
CREATE TABLE IF NOT EXISTS deletion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_user_id uuid NOT NULL,
  deleted_username text NOT NULL,
  deleted_email text,
  deletion_reason text NOT NULL,
  coins_forfeited numeric DEFAULT 0,
  deletion_date timestamptz DEFAULT now(),
  profile_data_snapshot jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deletion_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Deletion logs are viewable by authenticated users" ON deletion_logs;

-- Create policy for deletion logs
CREATE POLICY "Deletion logs are viewable by authenticated users"
  ON deletion_logs FOR SELECT
  TO authenticated
  USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_last_activity ON profiles(last_activity_date) WHERE account_status = 'active';
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_date ON deletion_logs(deletion_date DESC);

-- Function to update last_activity_date
CREATE OR REPLACE FUNCTION update_last_activity(user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET 
    last_activity_date = now(),
    account_status = 'active',
    deletion_warning_sent = false,
    scheduled_deletion_date = NULL
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to anonymize deleted user references
CREATE OR REPLACE FUNCTION anonymize_deleted_user_references(user_id uuid)
RETURNS void AS $$
BEGIN
  -- Update battles - keep records but anonymize
  UPDATE battles
  SET manager1_id = NULL
  WHERE manager1_id = user_id;

  UPDATE battles
  SET manager2_id = NULL
  WHERE manager2_id = user_id;

  UPDATE battles
  SET winner_id = NULL
  WHERE winner_id = user_id;

  -- Update messages - keep for conversation continuity
  UPDATE messages
  SET sender_id = NULL
  WHERE sender_id = user_id;

  -- Update comments - show as [Deleted User]
  UPDATE comments
  SET commenter_name = '[Deleted User]'
  WHERE commenter_id = user_id;

  -- Delete user's owned cards (they're transferred or removed)
  DELETE FROM card_ownership
  WHERE owner_id = user_id OR card_user_id = user_id;

  -- Delete user's transactions (historical data preserved in deletion_logs)
  DELETE FROM coin_transactions
  WHERE user_id = user_id;

  -- Delete user's notifications
  DELETE FROM notifications
  WHERE user_id = user_id OR actor_id = user_id;

  -- Delete user's ratings given/received
  DELETE FROM ratings
  WHERE rater_id = user_id OR player_id = user_id;

  -- Delete user's social links
  DELETE FROM social_links
  WHERE user_id = user_id;

  -- Delete user's presence
  DELETE FROM user_presence
  WHERE user_id = user_id;

  -- Delete user from leaderboard
  DELETE FROM leaderboard
  WHERE profile_id = user_id;

  -- Clean up other references
  DELETE FROM friends
  WHERE user_id = user_id OR friend_id = user_id;

  DELETE FROM profile_likes
  WHERE user_id = user_id OR profile_id = user_id;

  DELETE FROM profile_views
  WHERE viewer_id = user_id OR profile_id = user_id;

  DELETE FROM user_stats
  WHERE user_id = user_id;

  DELETE FROM coins
  WHERE user_id = user_id;

  DELETE FROM card_transactions
  WHERE card_user_id = user_id OR seller_id = user_id OR buyer_id = user_id;

  DELETE FROM card_offers
  WHERE card_user_id = user_id OR current_owner_id = user_id OR buyer_id = user_id;

  DELETE FROM username_history
  WHERE user_id = user_id;

  DELETE FROM conversations
  WHERE user_one_id = user_id OR user_two_id = user_id;

  DELETE FROM coin_transfers
  WHERE sender_id = user_id OR recipient_id = user_id;

  DELETE FROM battle_wagers
  WHERE manager_id = user_id;

  DELETE FROM battle_royalties
  WHERE original_owner_id = user_id;

  DELETE FROM verification_logs
  WHERE user_id = user_id;

  DELETE FROM user_notifications
  WHERE user_id = user_id OR related_user_id = user_id;

  DELETE FROM notification_counts
  WHERE user_id = user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process inactive account deletions
CREATE OR REPLACE FUNCTION process_inactive_account_deletions()
RETURNS TABLE(deleted_count integer, coins_returned numeric) AS $$
DECLARE
  user_record RECORD;
  total_deleted integer := 0;
  total_coins numeric := 0;
  user_coins numeric;
BEGIN
  -- Find users inactive for 90+ days
  FOR user_record IN
    SELECT id, username, email, coin_balance, last_activity_date
    FROM profiles
    WHERE account_status = 'active'
    AND last_activity_date < (now() - interval '90 days')
  LOOP
    BEGIN
      -- Get user's coin balance
      user_coins := COALESCE(user_record.coin_balance, 0);
      
      -- Return coins to master pool
      IF user_coins > 0 THEN
        UPDATE coin_pool
        SET 
          remaining_coins = remaining_coins + user_coins,
          distributed_coins = distributed_coins - user_coins,
          updated_at = now()
        WHERE id = (SELECT id FROM coin_pool LIMIT 1);
      END IF;

      -- Log the deletion
      INSERT INTO deletion_logs (
        deleted_user_id,
        deleted_username,
        deleted_email,
        deletion_reason,
        coins_forfeited,
        profile_data_snapshot
      ) VALUES (
        user_record.id,
        user_record.username,
        user_record.email,
        'inactive_3_months',
        user_coins,
        jsonb_build_object(
          'username', user_record.username,
          'email', user_record.email,
          'coin_balance', user_coins,
          'last_activity_date', user_record.last_activity_date
        )
      );

      -- Anonymize user references
      PERFORM anonymize_deleted_user_references(user_record.id);

      -- Mark account as deleted and set balance to 0
      UPDATE profiles
      SET 
        account_status = 'deleted',
        coin_balance = 0,
        updated_at = now()
      WHERE id = user_record.id;

      -- Increment counters
      total_deleted := total_deleted + 1;
      total_coins := total_coins + user_coins;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with next user
      RAISE WARNING 'Failed to delete user %: %', user_record.id, SQLERRM;
      CONTINUE;
    END;
  END LOOP;

  RETURN QUERY SELECT total_deleted, total_coins;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check for users needing deletion warning (76 days inactive)
CREATE OR REPLACE FUNCTION check_deletion_warnings()
RETURNS TABLE(user_id uuid, username text, email text, days_until_deletion integer) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.email,
    14 as days_until_deletion
  FROM profiles p
  WHERE p.account_status = 'active'
  AND p.deletion_warning_sent = false
  AND p.last_activity_date < (now() - interval '76 days')
  AND p.last_activity_date >= (now() - interval '90 days');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark warning as sent
CREATE OR REPLACE FUNCTION mark_deletion_warning_sent(user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET 
    deletion_warning_sent = true,
    scheduled_deletion_date = last_activity_date + interval '90 days'
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update last_activity_date on profile updates
CREATE OR REPLACE FUNCTION trigger_update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_date := now();
  NEW.account_status := 'active';
  NEW.deletion_warning_sent := false;
  NEW.scheduled_deletion_date := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to profile updates (but not system updates)
DROP TRIGGER IF EXISTS update_profile_activity ON profiles;
CREATE TRIGGER update_profile_activity
  BEFORE UPDATE OF full_name, bio, avatar_url, position, team ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_last_activity();

-- Initialize last_activity_date for existing users
UPDATE profiles
SET last_activity_date = COALESCE(last_active, created_at, now())
WHERE last_activity_date IS NULL;

-- Set all existing users to active status
UPDATE profiles
SET account_status = 'active'
WHERE account_status IS NULL;
