/*
  # Harden RLS Policies on Core Tables

  ## Overview
  Security audit and hardening of RLS policies on profiles, ratings, comments,
  and friends tables. Drops and re-creates mutation policies to ensure:
  - Users can ONLY modify their own data
  - No USING(true) or WITH CHECK(true) on mutation policies
  - Explicit DENY DELETE on profiles (accounts should not be deletable via API)

  ## Tables Affected
  1. **profiles** - Re-assert UPDATE policy with ownership check, add explicit DELETE deny
  2. **ratings** - Re-assert UPDATE/DELETE policies with rater_id ownership check
  3. **comments** - Re-assert UPDATE/DELETE policies with commenter_id ownership check
  4. **friends** - Re-assert UPDATE/DELETE policies with membership check (either party)

  ## Security
  - Every mutation policy enforces auth.uid() ownership
  - No permissive wildcard policies on any mutation operation
  - Profiles cannot be deleted through the API at all
*/

-- ============================================================================
-- PROFILES: Harden UPDATE, add explicit DELETE deny
-- ============================================================================

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_deny_delete" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_deny_delete"
  ON profiles FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- RATINGS: Harden UPDATE and DELETE
-- ============================================================================

DROP POLICY IF EXISTS "ratings_update_policy" ON ratings;
DROP POLICY IF EXISTS "ratings_delete_policy" ON ratings;

CREATE POLICY "ratings_update_policy"
  ON ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = rater_id)
  WITH CHECK (auth.uid() = rater_id);

CREATE POLICY "ratings_delete_policy"
  ON ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = rater_id);

-- ============================================================================
-- COMMENTS: Harden UPDATE and DELETE
-- ============================================================================

DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;

CREATE POLICY "Users can update their own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = commenter_id)
  WITH CHECK (auth.uid() = commenter_id);

CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (auth.uid() = commenter_id);

-- ============================================================================
-- FRIENDS: Harden UPDATE and DELETE (both parties can modify)
-- ============================================================================

DROP POLICY IF EXISTS "Users can update friendships" ON friends;
DROP POLICY IF EXISTS "Users can delete friendships" ON friends;

CREATE POLICY "Users can update friendships"
  ON friends FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete friendships"
  ON friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
