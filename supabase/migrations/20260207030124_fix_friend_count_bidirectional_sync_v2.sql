/*
  # Fix Friend Count to Use Bidirectional Counting

  ## Problem
  The current friend_count logic only counts one side of the relationship:
  - For user_id: Counts WHERE user_id = X (friends they added)
  - For friend_id: Counts WHERE friend_id = X (people who added them)
  
  This is incorrect because friendships are bidirectional - a user should see ALL accepted
  friendships regardless of who initiated the request.

  ## Solution
  Update the friend_count logic to count ALL accepted friendships where the user appears
  in EITHER the user_id OR friend_id column.

  ## Changes
  1. Fix the update_friend_count() function to count bidirectionally
  2. Resync all existing friend counts using the corrected logic
  3. Update profile_summary table to match

  ## Security
  - Function uses SECURITY DEFINER with restricted search_path
  - All operations are atomic
*/

-- Drop existing function
DROP FUNCTION IF EXISTS update_friend_count() CASCADE;

-- Create corrected function with bidirectional counting
CREATE OR REPLACE FUNCTION update_friend_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id_1 uuid;
  v_user_id_2 uuid;
BEGIN
  -- Determine which user IDs to update
  IF TG_OP = 'DELETE' THEN
    v_user_id_1 := OLD.user_id;
    v_user_id_2 := OLD.friend_id;
  ELSE
    v_user_id_1 := NEW.user_id;
    v_user_id_2 := NEW.friend_id;
  END IF;

  -- Update friend_count for user_id (count ALL accepted relationships)
  UPDATE profiles
  SET friend_count = (
    SELECT COUNT(*)
    FROM friends f
    WHERE (f.user_id = v_user_id_1 OR f.friend_id = v_user_id_1)
      AND f.status = 'accepted'
  )
  WHERE id = v_user_id_1;

  -- Update friend_count for friend_id (count ALL accepted relationships)
  UPDATE profiles
  SET friend_count = (
    SELECT COUNT(*)
    FROM friends f
    WHERE (f.user_id = v_user_id_2 OR f.friend_id = v_user_id_2)
      AND f.status = 'accepted'
  )
  WHERE id = v_user_id_2;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS trigger_update_friend_count_insert ON friends;
DROP TRIGGER IF EXISTS trigger_update_friend_count_update ON friends;
DROP TRIGGER IF EXISTS trigger_update_friend_count_delete ON friends;

CREATE TRIGGER trigger_update_friend_count_insert
AFTER INSERT ON friends
FOR EACH ROW
EXECUTE FUNCTION update_friend_count();

CREATE TRIGGER trigger_update_friend_count_update
AFTER UPDATE OF status ON friends
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_friend_count();

CREATE TRIGGER trigger_update_friend_count_delete
AFTER DELETE ON friends
FOR EACH ROW
EXECUTE FUNCTION update_friend_count();

-- Resync ALL user friend counts using the corrected logic
UPDATE profiles p
SET friend_count = (
  SELECT COUNT(*)
  FROM friends f
  WHERE (f.user_id = p.id OR f.friend_id = p.id)
    AND f.status = 'accepted'
);

-- Also update profile_summary to match
UPDATE profile_summary ps
SET friend_count = (
  SELECT p.friend_count
  FROM profiles p
  WHERE p.id = ps.user_id
)
WHERE EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = ps.user_id
);

-- Display results for verification
DO $$
DECLARE
  v_total_users int;
  v_users_with_friends int;
  v_max_friends int;
BEGIN
  SELECT COUNT(*) INTO v_total_users FROM profiles;
  SELECT COUNT(*) INTO v_users_with_friends FROM profiles WHERE friend_count > 0;
  SELECT COALESCE(MAX(friend_count), 0) INTO v_max_friends FROM profiles;
  
  RAISE NOTICE '✓ Friend count resync completed successfully';
  RAISE NOTICE '  Total users: %', v_total_users;
  RAISE NOTICE '  Users with friends: %', v_users_with_friends;
  RAISE NOTICE '  Max friends any user has: %', v_max_friends;
END $$;
