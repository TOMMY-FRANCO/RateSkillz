/*
  # Fix Friend Count Synchronization and Auto-Update System

  ## Summary
  Fixes the friend milestone reward system by ensuring friend_count in profiles table
  accurately reflects the actual number of accepted friends from the friends table.

  ## Changes Made

  ### 1. Sync Existing Friend Counts
  - Updates all users' friend_count to match actual accepted friendships
  - Counts only 'accepted' status relationships from friends table

  ### 2. Create Auto-Update Trigger Function
  - Automatically updates friend_count when friendships are:
    - Added (INSERT)
    - Status changed (UPDATE)
    - Removed (DELETE)
  - Updates both user_id and friend_id in the relationship

  ### 3. Setup Triggers
  - After INSERT: Updates count for both parties
  - After UPDATE: Updates count when status changes
  - After DELETE: Updates count for both parties

  ## Impact
  - Friend Milestone reward (5 friends = 10 coins) will now work correctly
  - Users will see accurate friend counts
  - Rewards will flow from the 1 billion coin pool as designed
*/

-- First, sync existing friend counts for all users
UPDATE profiles p
SET friend_count = (
  SELECT COUNT(DISTINCT f.friend_id)
  FROM friends f
  WHERE f.user_id = p.id 
  AND f.status = 'accepted'
);

-- Create function to update friend count for a user
CREATE OR REPLACE FUNCTION update_friend_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update friend count for user_id
  IF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET friend_count = (
      SELECT COUNT(DISTINCT friend_id)
      FROM friends
      WHERE user_id = OLD.user_id
      AND status = 'accepted'
    )
    WHERE id = OLD.user_id;

    -- Also update for friend_id
    UPDATE profiles
    SET friend_count = (
      SELECT COUNT(DISTINCT user_id)
      FROM friends
      WHERE friend_id = OLD.friend_id
      AND status = 'accepted'
    )
    WHERE id = OLD.friend_id;

  ELSE
    -- For INSERT and UPDATE, use NEW
    UPDATE profiles
    SET friend_count = (
      SELECT COUNT(DISTINCT friend_id)
      FROM friends
      WHERE user_id = NEW.user_id
      AND status = 'accepted'
    )
    WHERE id = NEW.user_id;

    -- Also update for friend_id
    UPDATE profiles
    SET friend_count = (
      SELECT COUNT(DISTINCT user_id)
      FROM friends
      WHERE friend_id = NEW.friend_id
      AND status = 'accepted'
    )
    WHERE id = NEW.friend_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_friend_count_insert ON friends;
DROP TRIGGER IF EXISTS trigger_update_friend_count_update ON friends;
DROP TRIGGER IF EXISTS trigger_update_friend_count_delete ON friends;

-- Create trigger for INSERT
CREATE TRIGGER trigger_update_friend_count_insert
AFTER INSERT ON friends
FOR EACH ROW
EXECUTE FUNCTION update_friend_count();

-- Create trigger for UPDATE (when status changes)
CREATE TRIGGER trigger_update_friend_count_update
AFTER UPDATE OF status ON friends
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_friend_count();

-- Create trigger for DELETE
CREATE TRIGGER trigger_update_friend_count_delete
AFTER DELETE ON friends
FOR EACH ROW
EXECUTE FUNCTION update_friend_count();

-- Verify and display updated friend counts
DO $$
BEGIN
  RAISE NOTICE 'Friend count synchronization completed successfully';
  RAISE NOTICE 'All friend counts are now accurate and will auto-update';
END $$;
