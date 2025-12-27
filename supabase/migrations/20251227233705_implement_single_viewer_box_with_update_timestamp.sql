/*
  # Implement Single Viewer Box with Update Timestamp

  ## Overview
  - Show ONE box per viewer (not multiple duplicate entries)
  - Update timestamp on repeat visits instead of creating new records
  - Display relative time ("2 hours ago", "today", etc.)
  - Send notifications with view count since last check
  - Sort by most recent views at top

  ## Changes Made
  
  1. **Clean Up Duplicate Records**
     - Remove duplicate views from same viewer
     - Keep only the most recent view per viewer
  
  2. **Add Unique Constraint**
     - Restore unique constraint on (profile_id, viewer_id)
     - Ensures only one record per viewer per profile
  
  3. **Update View Recording Function**
     - Use UPSERT logic (INSERT ... ON CONFLICT ... UPDATE)
     - Updates viewed_at timestamp on repeat views
     - Increments counter only on NEW viewers (not updates)
  
  4. **Track Unread View Count**
     - Add unread_profile_views column to profiles
     - Increment on new views
     - Reset when user checks ViewedMe page
  
  ## Impact
  - ViewedMe page shows one box per viewer
  - Timestamp updates on repeat visits
  - Most recent views appear at top
  - Users see accurate "new views" count
*/

-- Step 1: Clean up duplicate records (keep most recent per viewer)
DELETE FROM profile_views
WHERE id NOT IN (
  SELECT DISTINCT ON (profile_id, viewer_id) id
  FROM profile_views
  ORDER BY profile_id, viewer_id, viewed_at DESC
);

-- Step 2: Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_unique_viewer 
  ON profile_views (profile_id, viewer_id) 
  WHERE viewer_id IS NOT NULL;

-- Step 3: Add unread views counter to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS unread_profile_views integer DEFAULT 0;

-- Step 4: Update view recording function with UPSERT logic
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
  v_is_new_viewer boolean := false;
  v_existing_id uuid;
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

  -- Check if this is a new viewer or repeat view
  SELECT id INTO v_existing_id
  FROM profile_views
  WHERE profile_id = p_profile_id AND viewer_id = p_viewer_id;

  -- UPSERT: Insert new view or update timestamp on existing view
  INSERT INTO profile_views (profile_id, viewer_id, viewed_at)
  VALUES (p_profile_id, p_viewer_id, now())
  ON CONFLICT (profile_id, viewer_id) WHERE viewer_id IS NOT NULL
  DO UPDATE SET viewed_at = now()
  RETURNING (xmax = 0) INTO v_is_new_viewer;  -- xmax = 0 means INSERT, not UPDATE

  -- Only increment counters for NEW viewers
  IF v_is_new_viewer THEN
    UPDATE profiles
    SET 
      profile_views_count = COALESCE(profile_views_count, 0) + 1,
      unread_profile_views = COALESCE(unread_profile_views, 0) + 1
    WHERE id = p_profile_id
    RETURNING profile_views_count INTO v_new_count;

    RETURN jsonb_build_object(
      'success', true,
      'counted', true,
      'new_count', v_new_count,
      'is_new_viewer', true,
      'message', 'New view recorded'
    );
  ELSE
    -- Repeat view - timestamp updated but counter unchanged
    SELECT profile_views_count INTO v_new_count
    FROM profiles
    WHERE id = p_profile_id;

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

-- Step 5: Update notification function to only notify on NEW viewers
DROP TRIGGER IF EXISTS trigger_notify_profile_view ON profile_views;

CREATE OR REPLACE FUNCTION notify_profile_view()
RETURNS TRIGGER AS $$
DECLARE
  v_is_new_viewer boolean;
  v_unread_count integer;
BEGIN
  -- Only create notification for new viewers (not timestamp updates)
  IF NEW.viewer_id IS NOT NULL AND NEW.viewer_id != NEW.profile_id THEN
    -- Check if this is a new view or update
    v_is_new_viewer := (TG_OP = 'INSERT' AND NOT EXISTS (
      SELECT 1 FROM profile_views 
      WHERE profile_id = NEW.profile_id 
        AND viewer_id = NEW.viewer_id 
        AND id != NEW.id
    ));

    IF v_is_new_viewer OR TG_OP = 'INSERT' THEN
      -- Get unread count
      SELECT COALESCE(unread_profile_views, 0) 
      INTO v_unread_count
      FROM profiles 
      WHERE id = NEW.profile_id;

      -- Create notification with unread count
      PERFORM create_notification(
        NEW.profile_id,
        'profile_view',
        NEW.id,
        NEW.viewer_id,
        CASE 
          WHEN v_unread_count > 1 THEN 
            v_unread_count || ' people viewed your profile'
          ELSE 
            'Someone viewed your profile'
        END
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_profile_view
  AFTER INSERT OR UPDATE ON profile_views
  FOR EACH ROW
  EXECUTE FUNCTION notify_profile_view();

-- Step 6: Create function to mark profile views as read
CREATE OR REPLACE FUNCTION mark_profile_views_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET unread_profile_views = 0
  WHERE id = p_user_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mark_profile_views_read(uuid) TO authenticated;
