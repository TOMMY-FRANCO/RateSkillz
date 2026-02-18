/*
  # Fix record_unique_profile_view to update profile_view_cache

  ## Summary
  Replaces the existing record_unique_profile_view function with an improved version that:
  1. Inserts a row into profile_views with profile_id and viewer_id (unique per viewer per profile)
  2. On first view: increments profile_views_count and unread_profile_views on profiles
  3. Always updates profile_view_cache with last_viewer_id, last_viewer_username, last_viewed_at
  4. Never counts self-views
  5. Never counts anonymous views
  6. Catches all errors silently and returns success:false without throwing
*/

CREATE OR REPLACE FUNCTION public.record_unique_profile_view(
  p_profile_id uuid,
  p_viewer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_new_count integer;
  v_is_new_viewer boolean := false;
  v_viewer_username text;
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

  -- Get viewer username for cache update
  SELECT username INTO v_viewer_username
  FROM profiles
  WHERE id = p_viewer_id;

  -- UPSERT: Insert new view or update timestamp on existing view
  -- Uses the unique index on (profile_id, viewer_id) WHERE viewer_id IS NOT NULL
  INSERT INTO profile_views (profile_id, viewer_id, viewed_at)
  VALUES (p_profile_id, p_viewer_id, now())
  ON CONFLICT (profile_id, viewer_id) WHERE viewer_id IS NOT NULL
  DO UPDATE SET viewed_at = now()
  RETURNING (xmax = 0) INTO v_is_new_viewer;

  -- Only increment profile counters for NEW viewers (first visit only)
  IF v_is_new_viewer THEN
    UPDATE profiles
    SET
      profile_views_count = COALESCE(profile_views_count, 0) + 1,
      unread_profile_views = COALESCE(unread_profile_views, 0) + 1
    WHERE id = p_profile_id
    RETURNING profile_views_count INTO v_new_count;
  ELSE
    SELECT profile_views_count INTO v_new_count
    FROM profiles
    WHERE id = p_profile_id;
  END IF;

  -- Always update profile_view_cache with latest viewer details
  INSERT INTO profile_view_cache (
    user_id,
    last_viewer_id,
    last_viewer_username,
    last_viewed_at,
    recent_viewers_count,
    updated_at
  )
  VALUES (
    p_profile_id,
    p_viewer_id,
    v_viewer_username,
    now(),
    COALESCE(v_new_count, 0),
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    last_viewer_id = EXCLUDED.last_viewer_id,
    last_viewer_username = EXCLUDED.last_viewer_username,
    last_viewed_at = EXCLUDED.last_viewed_at,
    recent_viewers_count = EXCLUDED.recent_viewers_count,
    updated_at = now();

  IF v_is_new_viewer THEN
    RETURN jsonb_build_object(
      'success', true,
      'counted', true,
      'new_count', v_new_count,
      'is_new_viewer', true,
      'message', 'New view recorded'
    );
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'counted', false,
      'current_count', v_new_count,
      'is_new_viewer', false,
      'message', 'View timestamp updated'
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
