/*
  # Fix Friends System - DELETE Policy and Accept Conversation

  1. Security Changes
    - Update DELETE policy on `friends` table to allow BOTH the sender (user_id) 
      and receiver (friend_id) to delete the friendship row
    - Previously only user_id could delete, which meant receivers could NOT decline requests

  2. Important Notes
    - This fixes the bug where declining a friend request silently failed due to RLS
    - The receiver (friend_id) needs DELETE access to decline pending requests
    - Both parties need DELETE access to unfriend each other
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'friends' AND policyname = 'Users can delete friendships'
  ) THEN
    DROP POLICY "Users can delete friendships" ON friends;
  END IF;
END $$;

CREATE POLICY "Users can delete friendships"
  ON friends
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id 
    OR (SELECT auth.uid()) = friend_id
  );
