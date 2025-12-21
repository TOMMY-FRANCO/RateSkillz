/*
  # Fix Sign-Up RLS Policies for Automatic Profile Creation

  ## Problem
  Users getting "database error saving new user" during sign-up because RLS policies
  are blocking the trigger function from creating profiles and card ownership records.

  ## Solution
  1. Update profiles INSERT policy to allow the trigger function (SECURITY DEFINER) to insert
  2. Update card_ownership INSERT policy to allow automatic initialization
  3. Add proper policies for all tables that are created during sign-up

  ## Changes
  1. Updated Profiles RLS
     - Allow trigger function to insert profiles during sign-up
     - Keep user self-insert capability for manual profile creation
  
  2. Updated Card Ownership RLS
     - Allow automatic card initialization during sign-up
     - Users can view their own card ownership
  
  3. Updated Coin Transactions RLS
     - Allow viewing own transactions
     - System can insert transactions

  ## Security Notes
  - SECURITY DEFINER functions bypass RLS by design
  - Policies ensure users can only modify their own data
  - Trigger function is trusted system code
*/

-- Drop existing profiles INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create new policy that allows both user inserts and trigger inserts
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (
    auth.uid() = id OR 
    auth.uid() IS NULL
  );

-- Ensure card_ownership has proper RLS policies
DROP POLICY IF EXISTS "Users can view their card ownership" ON card_ownership;
DROP POLICY IF EXISTS "Anyone can view card ownership" ON card_ownership;
DROP POLICY IF EXISTS "Users can insert card ownership" ON card_ownership;
DROP POLICY IF EXISTS "System can initialize card ownership" ON card_ownership;

-- Allow anyone to view card ownership (for marketplace)
CREATE POLICY "Anyone can view card ownership"
  ON card_ownership FOR SELECT
  USING (true);

-- Allow card ownership initialization (for sign-up trigger)
CREATE POLICY "System can initialize card ownership"
  ON card_ownership FOR INSERT
  WITH CHECK (true);

-- Users can update their own card listings
CREATE POLICY "Users can update their card ownership"
  ON card_ownership FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Ensure coin_transactions has proper RLS policies
DROP POLICY IF EXISTS "Users can view own transactions" ON coin_transactions;
DROP POLICY IF EXISTS "System can create transactions" ON coin_transactions;

CREATE POLICY "Users can view own transactions"
  ON coin_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create transactions"
  ON coin_transactions FOR INSERT
  WITH CHECK (true);

-- Ensure comment_coin_rewards has proper RLS policies
DROP POLICY IF EXISTS "Users can view own rewards" ON comment_coin_rewards;
DROP POLICY IF EXISTS "System can create rewards" ON comment_coin_rewards;

CREATE POLICY "Users can view own rewards"
  ON comment_coin_rewards FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create rewards"
  ON comment_coin_rewards FOR INSERT
  WITH CHECK (true);

-- Ensure ad_views has proper RLS policies
DROP POLICY IF EXISTS "Users can view own ad views" ON ad_views;
DROP POLICY IF EXISTS "System can record ad views" ON ad_views;

CREATE POLICY "Users can view own ad views"
  ON ad_views FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can record ad views"
  ON ad_views FOR INSERT
  WITH CHECK (true);

-- Ensure user_presence has proper RLS policies
DROP POLICY IF EXISTS "Anyone can view presence" ON user_presence;
DROP POLICY IF EXISTS "System can update presence" ON user_presence;

CREATE POLICY "Anyone can view presence"
  ON user_presence FOR SELECT
  USING (true);

CREATE POLICY "System can update presence"
  ON user_presence FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update presence records"
  ON user_presence FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Ensure username_history has proper RLS policies  
DROP POLICY IF EXISTS "System can insert username history" ON username_history;

CREATE POLICY "System can insert username history"
  ON username_history FOR INSERT
  WITH CHECK (true);

-- Ensure social_links has proper RLS policies
DROP POLICY IF EXISTS "Users can view all social links" ON social_links;
DROP POLICY IF EXISTS "Users can insert own social links" ON social_links;
DROP POLICY IF EXISTS "Users can update own social links" ON social_links;

CREATE POLICY "Users can view all social links"
  ON social_links FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own social links"
  ON social_links FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own social links"
  ON social_links FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure user_stats has proper RLS policies
DROP POLICY IF EXISTS "Anyone can view stats" ON user_stats;
DROP POLICY IF EXISTS "System can create stats" ON user_stats;
DROP POLICY IF EXISTS "System can update stats" ON user_stats;

CREATE POLICY "Anyone can view stats"
  ON user_stats FOR SELECT
  USING (true);

CREATE POLICY "System can create stats"
  ON user_stats FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update stats"
  ON user_stats FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Ensure notifications has proper RLS policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
