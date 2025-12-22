/*
  # Fix Leaderboard DELETE Error - Replace DELETE with TRUNCATE
  
  1. Problem
    - refresh_leaderboard() function uses DELETE FROM leaderboard without WHERE clause
    - RLS policies block this operation causing "DELETE requires a WHERE clause" error
    - This error appears when users save ratings (triggers leaderboard refresh)
  
  2. Solution
    - Replace DELETE FROM leaderboard with TRUNCATE TABLE leaderboard
    - TRUNCATE is designed for deleting all rows and bypasses RLS
    - Much more efficient for clearing tables
  
  3. Impact
    - Users can now save ratings without errors
    - Leaderboard refresh works correctly
    - No RLS policy conflicts
*/

-- Replace the refresh_leaderboard function to use TRUNCATE instead of DELETE
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_rank INTEGER := 1;
  v_profile RECORD;
BEGIN
  -- Create temporary table with new rankings
  CREATE TEMP TABLE IF NOT EXISTS temp_leaderboard AS
  SELECT 
    ROW_NUMBER() OVER (ORDER BY p.overall_rating DESC, p.created_at ASC) AS new_rank,
    p.id AS profile_id,
    p.overall_rating,
    p.username,
    p.full_name,
    p.avatar_url,
    p.position,
    p.team,
    l.rank AS old_rank
  FROM profiles p
  LEFT JOIN leaderboard l ON l.profile_id = p.id
  WHERE p.overall_rating IS NOT NULL
  ORDER BY p.overall_rating DESC, p.created_at ASC
  LIMIT 150;

  -- Use TRUNCATE instead of DELETE (bypasses RLS and is more efficient)
  TRUNCATE TABLE leaderboard;

  -- Insert new rankings
  INSERT INTO leaderboard (
    rank,
    profile_id,
    overall_rating,
    previous_rank,
    username,
    full_name,
    avatar_url,
    position,
    team,
    updated_at
  )
  SELECT 
    new_rank,
    profile_id,
    overall_rating,
    old_rank,
    username,
    full_name,
    avatar_url,
    position,
    team,
    now()
  FROM temp_leaderboard;

  -- Clean up temp table
  DROP TABLE IF EXISTS temp_leaderboard;
END;
$$;
