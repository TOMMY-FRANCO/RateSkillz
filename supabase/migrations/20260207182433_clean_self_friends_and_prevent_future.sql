/*
  # Clean Self-Friend Requests and Prevent Future Occurrences

  1. Changes
    - Delete existing self-friend requests where user_id = friend_id
    - Add CHECK constraint to friends table to prevent user_id = friend_id
    - This ensures users cannot send friend requests to themselves at database level

  2. Security
    - Removes invalid self-referencing friend relationships
    - Prevents future self-friend requests at database level
    - Maintains data integrity
*/

-- Step 1: Delete any existing self-friend requests
DELETE FROM friends WHERE user_id = friend_id;

-- Step 2: Add CHECK constraint to prevent future self-friending
ALTER TABLE friends
  ADD CONSTRAINT no_self_friending CHECK (user_id != friend_id);

-- Add comment to document the constraint
COMMENT ON CONSTRAINT no_self_friending ON friends IS
  'Prevents users from sending friend requests to themselves';
