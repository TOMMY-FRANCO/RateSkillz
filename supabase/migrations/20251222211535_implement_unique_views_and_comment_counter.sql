/*
  # Implement Unique Profile Views and Comment Counter

  ## Overview
  This migration updates the profile views system to enforce one view per user
  and adds a comment counter to track total comments per profile.

  ## Changes Made

  ### 1. Profile Views - Unique Constraint
  - Add unique constraint on (profile_id, viewer_id) to prevent duplicate views
  - Only one view record per viewer per profile
  - Existing duplicate records are handled by keeping the earliest view

  ### 2. Comments Counter
  - Add `comments_count` column to profiles table
  - Initialize with actual comment counts from existing data
  - Create trigger to automatically maintain count when comments are added/deleted

  ### 3. New Functions

  #### record_unique_profile_view
  - Records a profile view only if viewer hasn't viewed before
  - Prevents self-views (profile owner viewing own profile)
  - Returns success status and whether view was counted
  - Handles race conditions with ON CONFLICT clause

  #### sync_profile_comments_count
  - Recalculates and updates comments_count for all profiles
  - Ensures data integrity

  ### 4. Triggers

  #### increment_comments_count_trigger
  - Automatically increments comments_count when a comment is created

  #### decrement_comments_count_trigger
  - Automatically decrements comments_count when a comment is deleted

  ## Security
  - All functions use SECURITY DEFINER for proper access control
  - RLS policies remain unchanged and secure
  - Triggers execute with proper permissions

  ## Important Notes
  1. **Unique Views**: Each user can only be counted once per profile
  2. **No Self-Views**: Profile owners viewing their own profile are not counted
  3. **Automatic Counters**: Comment counts are maintained automatically via triggers
  4. **Data Integrity**: Existing data is migrated and synced properly
*/

-- Step 1: Clean up duplicate profile views, keeping only the earliest view per viewer per profile
DELETE FROM profile_views a
USING profile_views b
WHERE a.id > b.id
  AND a.profile_id = b.profile_id
  AND a.viewer_id = b.viewer_id
  AND a.viewer_id IS NOT NULL;

-- Step 2: Add unique constraint to profile_views to prevent future duplicates
DROP INDEX IF EXISTS idx_profile_views_unique_viewer;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_unique_viewer 
  ON profile_views(profile_id, viewer_id) 
  WHERE viewer_id IS NOT NULL;

-- Step 3: Recalculate profile_views_count based on unique viewers
UPDATE profiles
SET profile_views_count = (
  SELECT COUNT(DISTINCT viewer_id)
  FROM profile_views
  WHERE profile_views.profile_id = profiles.id
    AND profile_views.viewer_id IS NOT NULL
    AND profile_views.viewer_id != profiles.id
);

-- Step 4: Add comments_count column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'comments_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN comments_count integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Step 5: Initialize comments_count with actual counts from comments table
UPDATE profiles
SET comments_count = (
  SELECT COUNT(*)
  FROM comments
  WHERE comments.profile_id = profiles.id
);

-- Step 6: Create improved function to record unique profile views
CREATE OR REPLACE FUNCTION record_unique_profile_view(
  p_profile_id uuid,
  p_viewer_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
  v_new_count integer;
  v_view_recorded boolean := false;
BEGIN
  -- Don't record if viewer is null (anonymous) or if viewer is the profile owner
  IF p_viewer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'message', 'Anonymous views are not counted'
    );
  END IF;

  IF p_viewer_id = p_profile_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'message', 'Self-views are not counted'
    );
  END IF;

  -- Try to insert view record with ON CONFLICT to handle race conditions
  INSERT INTO profile_views (profile_id, viewer_id, viewed_at)
  VALUES (p_profile_id, p_viewer_id, now())
  ON CONFLICT (profile_id, viewer_id) WHERE viewer_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_view_recorded;

  -- If a new view was recorded, increment the counter
  IF v_view_recorded IS NOT NULL THEN
    UPDATE profiles
    SET profile_views_count = COALESCE(profile_views_count, 0) + 1
    WHERE id = p_profile_id
    RETURNING profile_views_count INTO v_new_count;

    RETURN jsonb_build_object(
      'success', true,
      'counted', true,
      'new_count', v_new_count,
      'message', 'View recorded successfully'
    );
  ELSE
    -- View already existed, don't count again
    SELECT profile_views_count INTO v_new_count
    FROM profiles
    WHERE id = p_profile_id;

    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'current_count', v_new_count,
      'message', 'View already recorded for this user'
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'counted', false,
      'error', SQLERRM
    );
END;
$$;

-- Step 7: Create function to sync comments count (for data integrity checks)
CREATE OR REPLACE FUNCTION sync_profile_comments_count()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET comments_count = (
    SELECT COUNT(*)
    FROM comments
    WHERE comments.profile_id = profiles.id
  );
END;
$$;

-- Step 8: Create trigger function to increment comments_count when comment is created
CREATE OR REPLACE FUNCTION increment_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET comments_count = COALESCE(comments_count, 0) + 1
  WHERE id = NEW.profile_id;
  
  RETURN NEW;
END;
$$;

-- Step 9: Create trigger function to decrement comments_count when comment is deleted
CREATE OR REPLACE FUNCTION decrement_comments_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
  WHERE id = OLD.profile_id;
  
  RETURN OLD;
END;
$$;

-- Step 10: Create triggers on comments table
DROP TRIGGER IF EXISTS comments_insert_trigger ON comments;
CREATE TRIGGER comments_insert_trigger
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION increment_comments_count();

DROP TRIGGER IF EXISTS comments_delete_trigger ON comments;
CREATE TRIGGER comments_delete_trigger
  AFTER DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION decrement_comments_count();

-- Step 11: Add index on comments.profile_id for faster counting
CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON comments(profile_id);
