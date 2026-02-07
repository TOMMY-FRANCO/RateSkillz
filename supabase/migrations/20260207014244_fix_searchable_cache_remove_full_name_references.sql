/*
  # Fix searchable_users_cache to remove full_name references

  1. Updates
    - Update refresh_searchable_user_cache function to remove full_name column references
    - Search text now uses only username (privacy compliance)
    - Remove full_name from INSERT and UPDATE operations
  
  2. Security
    - Maintains SECURITY DEFINER for proper permissions
    - Keeps proper search_path setting
*/

-- Update the refresh_searchable_user_cache function to remove full_name references
CREATE OR REPLACE FUNCTION refresh_searchable_user_cache()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM searchable_users_cache WHERE user_id = OLD.id;
    RETURN OLD;
  ELSE
    INSERT INTO searchable_users_cache (
      user_id, 
      username, 
      team, 
      position, 
      avatar_url, 
      is_verified, 
      overall_rating, 
      search_text, 
      updated_at
    ) VALUES (
      NEW.id,
      NEW.username,
      NEW.team,
      NEW.position,
      NEW.avatar_url,
      NEW.is_verified,
      NEW.overall_rating,
      to_tsvector('simple',
        coalesce(NEW.username,'') || ' ' ||
        coalesce(NEW.team,'') || ' ' ||
        coalesce(NEW.position,'')
      ),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      username = EXCLUDED.username,
      team = EXCLUDED.team,
      position = EXCLUDED.position,
      avatar_url = EXCLUDED.avatar_url,
      is_verified = EXCLUDED.is_verified,
      overall_rating = EXCLUDED.overall_rating,
      search_text = EXCLUDED.search_text,
      updated_at = now();
    RETURN NEW;
  END IF;
END;
$$;

-- Log the fix
INSERT INTO admin_security_log (event_type, severity, operation_type, details)
VALUES (
  'validation_failed',
  'info',
  'searchable_cache_fix',
  jsonb_build_object(
    'action', 'removed_full_name_references',
    'function_updated', 'refresh_searchable_user_cache',
    'search_text_fields', jsonb_build_array('username', 'team', 'position'),
    'timestamp', now()
  )
);