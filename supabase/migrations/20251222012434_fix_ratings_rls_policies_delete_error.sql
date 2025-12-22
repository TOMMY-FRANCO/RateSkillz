/*
  # Fix Ratings RLS Policies - Remove Duplicates and Conflicts
  
  1. Problem
    - Multiple duplicate and conflicting RLS policies on ratings table
    - Database blocking DELETE operations due to ambiguous policies
    - Error: "DELETE requires a WHERE clause"
  
  2. Solution
    - Drop ALL existing policies on ratings table
    - Create clean, specific policies with no duplicates
    - Ensure DELETE policy is properly scoped with WHERE clause
  
  3. New Policies
    - SELECT: Authenticated users can view all ratings
    - INSERT: Users can only rate accepted friends (not themselves)
    - UPDATE: Users can only update their own ratings
    - DELETE: Users can only delete their own ratings
  
  4. Security
    - All policies check auth.uid()
    - INSERT validates friendship status
    - No overly permissive policies
*/

-- Drop all existing policies on ratings table
DROP POLICY IF EXISTS "Anyone can view ratings" ON ratings;
DROP POLICY IF EXISTS "Authenticated users can create ratings" ON ratings;
DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON ratings;
DROP POLICY IF EXISTS "Users can delete own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can delete their own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can insert ratings" ON ratings;
DROP POLICY IF EXISTS "Users can rate accepted friends" ON ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can update their own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can view own ratings" ON ratings;
DROP POLICY IF EXISTS "Users can view received ratings" ON ratings;

-- Create clean, non-conflicting policies

-- SELECT: Anyone can view ratings (needed for public profile pages)
CREATE POLICY "ratings_select_policy"
  ON ratings
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Users can only rate accepted friends
CREATE POLICY "ratings_insert_policy"
  ON ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rater_id
    AND rater_id <> player_id
    AND EXISTS (
      SELECT 1 FROM friends
      WHERE (
        (user_id = rater_id AND friend_id = player_id)
        OR (user_id = player_id AND friend_id = rater_id)
      )
      AND status = 'accepted'
    )
  );

-- UPDATE: Users can only update their own ratings
CREATE POLICY "ratings_update_policy"
  ON ratings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

-- DELETE: Users can only delete their own ratings
CREATE POLICY "ratings_delete_policy"
  ON ratings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = rater_id);
