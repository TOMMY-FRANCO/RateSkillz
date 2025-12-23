/*
  # Fix Coin Balance Public Visibility

  ## Problem
  The RLS policy on the `coins` table only allows users to view their own balance:
  - Policy: `USING (auth.uid() = user_id)`
  - This prevents users from seeing other users' coin balances on profiles
  - Results in 0.00 coins displayed when viewing other profiles

  ## Solution
  Update the RLS policy to allow ALL authenticated users to view ANY user's coin balance.
  Coin balances are meant to be public information displayed on user profiles.

  ## Changes
  1. Drop the restrictive "Users can view own coin balance" policy
  2. Create new policy allowing all authenticated users to view all coin balances
  3. Keep the service_role policy for system updates unchanged
  4. No changes to write permissions - only triggers can update balances

  ## Security
  - SELECT: All authenticated users can read all coin balances (public info)
  - INSERT/UPDATE/DELETE: Only service_role (via triggers) can modify balances
  - Users cannot manipulate their own or others' balances directly
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can view own coin balance" ON coins;

-- Create new policy allowing all authenticated users to view all coin balances
CREATE POLICY "All users can view all coin balances"
  ON coins FOR SELECT
  TO authenticated
  USING (true);

-- Verify service_role policy still exists for system operations
-- (This should already exist from the original migration, but we'll ensure it)
DROP POLICY IF EXISTS "System can manage coin balances" ON coins;
CREATE POLICY "System can manage coin balances"
  ON coins FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
