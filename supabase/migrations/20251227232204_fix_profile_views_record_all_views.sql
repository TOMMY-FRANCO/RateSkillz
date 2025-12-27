/*
  # Fix Profile Views to Record All Views (Not Just Unique)

  ## Problem
  - Profile views were only recording ONE view per viewer per profile
  - Users could not see multiple visits from the same person
  - TEST123 viewing tommy_franco didn't show because they viewed before

  ## Changes Made
  
  1. **Remove Unique Constraint**
     - Drop `idx_profile_views_unique_viewer` index
     - This allows multiple views from the same viewer to be recorded
  
  2. **Update View Recording Function**
     - Replace `record_unique_profile_view` with updated logic
     - Now records ALL views with timestamp
     - Still prevents self-views and anonymous views
     - Removes ON CONFLICT logic that was skipping duplicate views
  
  3. **Update View Count Logic**
     - profile_views_count now reflects total views (not unique viewers)
     - Each profile view increments the counter
  
  ## Impact
  - ViewedMe page will show all visits with timestamps
  - Sorted by most recent first (already implemented)
  - All users benefit from accurate view tracking
*/

-- Drop the unique index that prevents duplicate views
DROP INDEX IF EXISTS idx_profile_views_unique_viewer;

-- Drop and recreate the view recording function to record ALL views
DROP FUNCTION IF EXISTS record_unique_profile_view(uuid, uuid);

CREATE FUNCTION record_unique_profile_view(
  p_profile_id uuid,
  p_viewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count integer;
BEGIN
  -- Don't record if viewer is null (anonymous)
  IF p_viewer_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'message', 'Anonymous views are not counted'
    );
  END IF;

  -- Don't record if viewer is the profile owner
  IF p_viewer_id = p_profile_id THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'message', 'Self-views are not counted'
    );
  END IF;

  -- Record the view (allow duplicates from same viewer)
  INSERT INTO profile_views (profile_id, viewer_id, viewed_at)
  VALUES (p_profile_id, p_viewer_id, now());

  -- Increment the view counter
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

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'counted', false,
      'error', SQLERRM
    );
END;
$$;
